/**
 * 本番 PlayHistory 最新30件の読み取り専用集計（PROD_DATABASE_URL / .env.supabase の DATABASE_URL）
 * 実行: node scripts/analyze-play-history-latest30-prod.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    out[key] = val;
  }
  return out;
}

const envLocal = loadEnvFile(path.join(root, '.env.local'));
const envSupabase = loadEnvFile(path.join(root, '.env.supabase'));
const rawUrl = envLocal.PROD_DATABASE_URL || envSupabase.DATABASE_URL || '';

if (!rawUrl || rawUrl.startsWith('file:')) {
  console.error('PROD_DATABASE_URL または .env.supabase の DATABASE_URL（Postgres）が必要です。');
  process.exit(1);
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const MAX_REVEAL_MISSES = 3;
const EARLY_EXIT_REVIEW_Q = [25, 30, 35, 40];

function analyzeQuestionHistory(entries) {
  if (!Array.isArray(entries)) entries = [];
  let revealMiss = 0;
  let revealSuccess = 0;
  let revealOther = 0;
  let lastRevealResult = null;
  const kinds = {};
  let durationSum = 0;
  let durationCount = 0;
  let hardAfterExploreRuns = 0;
  let exploreAfterHardRuns = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const k = e?.kind || '?';
    kinds[k] = (kinds[k] || 0) + 1;
    if (typeof e?.durationSeconds === 'number' && !Number.isNaN(e.durationSeconds)) {
      durationSum += e.durationSeconds;
      durationCount++;
    }
    if (e?.kind === 'REVEAL') {
      const rr = e?.revealResult;
      lastRevealResult = rr;
      if (rr === 'MISS') revealMiss++;
      else if (rr === 'SUCCESS') revealSuccess++;
      else revealOther++;
    }
    const prev = entries[i - 1];
    // HARD→EXPLORE: 2連続HARD防止フォールバック等（§2.1 の「みだれうち」に関係しうる）
    if (prev?.kind === 'HARD_CONFIRM' && k === 'EXPLORE_TAG') exploreAfterHardRuns++;
    if (prev?.kind === 'EXPLORE_TAG' && k === 'HARD_CONFIRM') hardAfterExploreRuns++;
  }

  const late = entries.filter((e) => (e?.qIndex ?? 0) > 15);
  const kindsLate = {};
  for (const e of late) {
    const k = e?.kind || '?';
    kindsLate[k] = (kindsLate[k] || 0) + 1;
  }

  return {
    steps: entries.length,
    kinds,
    kindsLate,
    revealMiss,
    revealSuccess,
    revealOther,
    lastRevealResult,
    durationSum,
    durationCount,
    avgDurationSeconds: durationCount ? durationSum / durationCount : null,
    hardAfterExploreRuns,
    exploreAfterHardRuns,
  };
}

/**
 * FAIL_LIST / NOT_IN_LIST の主因プロキシ（DB に確度が無いため推定）
 */
function failListCauseProxy(outcome, questionCount, revealMiss) {
  if (outcome !== 'FAIL_LIST' && outcome !== 'NOT_IN_LIST') return null;
  if (revealMiss >= MAX_REVEAL_MISSES) {
    return {
      primary: 'reveal_miss_exhaustion',
      detail: `断定MISSが${revealMiss}回（上限${MAX_REVEAL_MISSES}到達想定）→ FAIL_LIST`,
    };
  }
  const nearReview = EARLY_EXIT_REVIEW_Q.some((q) => questionCount >= q - 1 && questionCount <= q + 2);
  if (revealMiss < MAX_REVEAL_MISSES && (nearReview || questionCount >= 20)) {
    return {
      primary: 'likely_early_exit_or_no_next_question',
      detail:
        '断定MISSが3未満のため、早期失敗（審査点）または次質問なし分岐の可能性が高い（確度はDBに無し）',
    };
  }
  return {
    primary: 'other',
    detail: '件数が少ない／経路不明',
  };
}

function abandonCauseProxy(questionCount, entries) {
  const k = entries?.kinds || {};
  if (questionCount <= 2) {
    return {
      primary: 'immediate_or_early_drop',
      detail: '質問がほぼ無い段階で離脱（動機・理解度・初動UXの問題も混ざりうる）',
    };
  }
  if (questionCount >= 20 && (k.REVEAL > 0 || k.HARD_CONFIRM > 5)) {
    return {
      primary: 'late_stage_fatigue_or_frustration',
      detail: '後半まで進んだが離脱（単調さ・断定／確認のストレスの可能性）',
    };
  }
  return {
    primary: 'mid_session_drop',
    detail: '中盤離脱',
  };
}

async function main() {
  const client = new Client({
    connectionString: rawUrl,
    ssl: rawUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT "outcome", "questionCount", "questionHistory", "aiGateChoice", "clickedFanza",
           "createdAt", "sessionStartedAt"
    FROM "PlayHistory"
    ORDER BY "createdAt" DESC
    LIMIT 30
  `);

  await client.end();

  if (rows.length === 0) {
    console.log('レコード0件');
    return;
  }

  const outcomes = {};
  const questionCounts = [];
  const analyses = [];

  for (const r of rows) {
    outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
    questionCounts.push(r.questionCount);
    let qh = [];
    try {
      qh = JSON.parse(r.questionHistory || '[]');
    } catch {
      qh = [];
    }
    const qhAnalysis = analyzeQuestionHistory(qh);
    analyses.push({
      outcome: r.outcome,
      questionCount: r.questionCount,
      aiGate: r.aiGateChoice,
      clickedFanza: r.clickedFanza,
      createdAt: r.createdAt,
      ...qhAnalysis,
    });
  }

  const avgQ = questionCounts.reduce((a, b) => a + b, 0) / questionCounts.length;

  const byFailCause = { reveal_miss_exhaustion: 0, likely_early_exit_or_no_next_question: 0, other: 0 };
  for (const a of analyses) {
    if (a.outcome === 'FAIL_LIST' || a.outcome === 'NOT_IN_LIST') {
      const p = failListCauseProxy(a.outcome, a.questionCount, a.revealMiss);
      a.causeProxy = p;
      if (p) byFailCause[p.primary] = (byFailCause[p.primary] || 0) + 1;
    } else if (a.outcome === 'ABANDONED') {
      a.causeProxy = abandonCauseProxy(a.questionCount, a);
    }
  }

  const abandoned = analyses.filter((a) => a.outcome === 'ABANDONED');
  const abandonByPrimary = {};
  for (const a of abandoned) {
    const p = a.causeProxy?.primary ?? '?';
    abandonByPrimary[p] = (abandonByPrimary[p] || 0) + 1;
  }

  const rhythm = {
    pairsHardThenExplore: analyses.reduce((s, a) => s + (a.exploreAfterHardRuns || 0), 0),
    pairsExploreThenHard: analyses.reduce((s, a) => s + (a.hardAfterExploreRuns || 0), 0),
    rowsWithHardExplorePairSumGte4: analyses.filter(
      (a) => (a.hardAfterExploreRuns || 0) + (a.exploreAfterHardRuns || 0) >= 4
    ).length,
  };

  console.log(JSON.stringify({
    sampleSize: rows.length,
    note: '原因プロキシ付き（確度・早期失敗の内部値はDBに無いため推定）',
    outcomeCounts: outcomes,
    questionCount: {
      min: Math.min(...questionCounts),
      max: Math.max(...questionCounts),
      avg: Math.round(avgQ * 10) / 10,
      median: median(questionCounts),
    },
    earlyShortPlay: {
      questionCountLte3: questionCounts.filter((n) => n <= 3).length,
      questionCountLte5: questionCounts.filter((n) => n <= 5).length,
    },
    failListCauseSummary: {
      countsByPrimary: byFailCause,
      narrative:
        'FAIL系で断定MISSが3回の行は「トップ1を外し続けた」苦しさ。3未満でFAILは早期失敗閾値・次質問枯渇などの線',
    },
    abandonedCauseSummary: {
      countsByPrimary: abandonByPrimary,
    },
    lateGameKindTotals: analyses.reduce((acc, a) => {
      const kl = a.kindsLate || {};
      for (const [k, v] of Object.entries(kl)) {
        acc[k] = (acc[k] || 0) + v;
      }
      return acc;
    }, {}),
    rhythm,
    revealRollup: {
      rowsWithAtLeastOneRevealMiss: analyses.filter((a) => a.revealMiss > 0).length,
      rowsWithLastRevealMiss: analyses.filter((a) => a.lastRevealResult === 'MISS').length,
      totalRevealMissSteps: analyses.reduce((s, a) => s + a.revealMiss, 0),
      totalRevealSuccessSteps: analyses.reduce((s, a) => s + a.revealSuccess, 0),
    },
    engagement: {
      aiGateDontCare: analyses.filter((a) => a.aiGate === 'DONT_CARE').length,
      clickedFanza: analyses.filter((a) => a.clickedFanza).length,
    },
    perRowBrief: analyses.map((a) => ({
      outcome: a.outcome,
      qCount: a.questionCount,
      stepsInHistory: a.steps,
      revealMiss: a.revealMiss,
      lastReveal: a.lastRevealResult,
      pingPongScore: (a.hardAfterExploreRuns || 0) + (a.exploreAfterHardRuns || 0),
      causeProxy: a.causeProxy ?? undefined,
      fanza: a.clickedFanza,
      createdAt: a.createdAt?.toISOString?.() || String(a.createdAt),
    })),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
