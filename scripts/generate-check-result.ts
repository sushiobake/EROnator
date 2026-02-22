#!/usr/bin/env tsx
/**
 * docs/check-instruction.md に沿ったチェック結果 JSON を生成して保存する。
 * - 入力: data/chatgpt-export/check-input.json（fetch-works-for-ai.ts --check の出力）
 * - 出力: data/chatgpt-export/check-result.json, data/chatgpt-export/check-pending.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';
import assert from 'assert';
import crypto from 'crypto';
import { z } from 'zod';

const root = path.resolve(process.cwd());

const INPUT_PATH = path.join(root, 'data', 'chatgpt-export', 'check-input.json');
const OUT_RESULT_PATH = path.join(root, 'data', 'chatgpt-export', 'check-result.json');
// 元々は check-pending.json にも直接書き出していたが、増分追記方式に合わせるため
// ここでは中間結果ファイルとして別名に出力し、append-check-batch.ts での追記を前提にする。
const OUT_PENDING_PATH = path.join(root, 'data', 'chatgpt-export', 'check-result-full.json');

const CheckInputSchema = z.object({
  allTags: z.object({
    s: z.array(z.string()),
    a: z.array(z.string()),
    b: z.array(z.string()),
  }),
  works: z.array(
    z.object({
      workId: z.string(),
      title: z.string(),
      commentText: z.string(),
      derivedTags: z.array(z.string()),
      officialTags: z.array(z.string()),
      characterName: z.string().nullable(),
      _error: z.string().optional(),
    })
  ),
});

type CheckInput = z.infer<typeof CheckInputSchema>;
type Work = CheckInput['works'][number];

type CheckReasoning = {
  タイトル照合: string;
  各タグ根拠: string;
  キャラ: string;
};

type OutputItem = {
  workId: string;
  title: string;
  result: 'タグ済' | '人間による確認が必要';
  checkReasoning: CheckReasoning;
  issues?: string[];
  tagChanges?: { added?: string[]; removed?: string[] };
  tagSuggestions?: { newProposal?: string };
};

function looksMojibake(s: string): boolean {
  // UTF-8 を Latin1 として誤解釈したときに出やすいパターン
  return /[Ãâãéèêëìíîïòóôöùúûü]|ã[\u0080-\u00bf]|â[\u0080-\u00bf]/.test(s);
}

function fixMojibake(s: string): string {
  if (!s) return s;
  if (!looksMojibake(s)) return s;
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf8');
    // 直した結果が空/置換だらけなら戻す
    if (!fixed || fixed.includes('\uFFFD')) return s;
    return fixed;
  } catch {
    return s;
  }
}

function uniq(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    const v = (s ?? '').trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return (s ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[・･\u3000]/g, '')
    .toLowerCase();
}

function includesNormalized(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  const h = normalizeForMatch(haystack);
  const n = normalizeForMatch(needle);
  if (!n) return false;
  return h.includes(n);
}

function isTooShortTag(tag: string): boolean {
  const t = tag.trim();
  if (!t) return true;
  // 例外: 2文字英数（JK, SF など）は許可
  if (/^[a-z0-9]{2}$/i.test(t)) return false;
  // 単独アルファベットや 1 文字はノイズになりやすい
  if (t.length <= 1) return true;
  return false;
}

function isCoveredByExistingTag(missing: string, existingTags: string[], title: string, commentText: string): boolean {
  // 既により具体的なタグが付いていて、かつタイトル/コメント上でも明確なら「不足」とみなさない
  for (const ex of existingTags) {
    if (!ex) continue;
    if (ex === missing) return true;
    if (ex.length > missing.length && includesNormalized(ex, missing)) {
      if (includesNormalized(title, ex) || includesNormalized(commentText, ex)) return true;
    }
  }
  // 軽い同義カバー（表記揺れ）
  const synonymCoveredBy: Record<string, string[]> = {
    爆乳: ['巨乳'],
    寝取られ: ['寝取り', '寝取られ・寝取られ・NTR', '寝取り・NTR'],
    NTR: ['寝取られ', '寝取り', '寝取られ・寝取られ・NTR', '寝取り・NTR'],
  };
  const covers = synonymCoveredBy[missing];
  if (covers && covers.some((c) => existingTags.includes(c))) return true;
  return false;
}

function hashShort(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}

function collectNameCandidates(comment: string): string[] {
  const text = comment ?? '';
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /([一-龯ぁ-んァ-ヶ]{2,12})(?:ちゃん|くん|さん|様|先輩)/g;
  for (const m of text.matchAll(re)) {
    const name = (m[1] ?? '').trim();
    if (!name) continue;
    if (['主人公', 'あなた', '彼女', '彼氏', '先生', 'ママ', 'パパ'].includes(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= 5) break;
  }
  return out;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`入力が見つかりません: ${INPUT_PATH}`);
  }
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const parsed = CheckInputSchema.parse(JSON.parse(raw)) as CheckInput;

  // allTags をデコード＆重複除去して set 化（tagChanges.added の制約用）
  const allS = uniq(parsed.allTags.s.map(fixMojibake));
  const allA = uniq(parsed.allTags.a.map(fixMojibake));
  const allB = uniq(parsed.allTags.b.map(fixMojibake));
  const allTagSet = new Set<string>([...allS, ...allA, ...allB]);
  const allTagsForTitleScan = [...allTagSet];

  const output: OutputItem[] = [];

  for (const w0 of parsed.works) {
    const workId = (w0.workId ?? '').trim();
    const title = fixMojibake(w0.title ?? '').trim();
    const commentText = fixMojibake(w0.commentText ?? '');
    const officialTags = uniq((w0.officialTags ?? []).map(fixMojibake));
    const derivedTags = uniq((w0.derivedTags ?? []).map(fixMojibake));
    const characterName = w0.characterName ? fixMojibake(w0.characterName).trim() : null;

    const issues: string[] = [];
    const added: string[] = [];
    const removed: string[] = [];

    if (!workId) {
      output.push({
        workId: w0.workId ?? '',
        title,
        result: '人間による確認が必要',
        checkReasoning: {
          タイトル照合: 'workId が空のため判定不能。',
          各タグ根拠: 'workId が空のため判定不能。',
          キャラ: 'workId が空のため判定不能。',
        },
        issues: ['workId が空'],
      });
      continue;
    }

    if (w0._error) {
      issues.push(`DB取得エラー: ${w0._error}`);
    }

    const allCurrentTags = uniq([...officialTags, ...derivedTags]);

    // --- ステップ1：タイトル照合（タイトルに出ている語→タグ反映） ---
    const missingFromTitle: string[] = [];
    for (const tag of allTagsForTitleScan) {
      if (isTooShortTag(tag)) continue;
      if (!includesNormalized(title, tag)) continue;
      const already = allCurrentTags.some((t) => t === tag);
      if (already) continue;
      if (isCoveredByExistingTag(tag, allCurrentTags, title, commentText)) continue;
      missingFromTitle.push(tag);
    }

    for (const t of missingFromTitle) {
      if (officialTags.includes(t)) continue; // 念のため
      if (!allTagSet.has(t)) continue; // added 制約
      if (!added.includes(t)) added.push(t);
    }

    if (missingFromTitle.length > 0) {
      issues.push(`タイトル語がタグに不足: ${missingFromTitle.slice(0, 8).join('、')}${missingFromTitle.length > 8 ? '…' : ''}`);
    }

    // シリーズ系の軽い注意（数字だけでは判定しない）
    const hasSeriesHint = /(続編|総集編|総集|前編|後編|第\d+|シーズン|連載|シリーズ)/.test(title);
    const hasSeriesTag = allCurrentTags.some((t) => /総集|続編|シリーズ|連載|ベスト|第\d+/.test(t));
    if (hasSeriesHint && !hasSeriesTag) {
      issues.push('タイトルに続編/総集/番号などがあるが、シリーズ系タグが見当たらない');
    }

    // --- ステップ2：derivedTags の根拠 ---
    const evidenceLines: string[] = [];
    for (const t of derivedTags) {
      const inTitle = includesNormalized(title, t);
      const inComment = includesNormalized(commentText, t);
      if (inTitle) {
        evidenceLines.push(`${t}: タイトルに明記`);
      } else if (inComment) {
        evidenceLines.push(`${t}: コメントに明記`);
      } else {
        evidenceLines.push(`${t}: 根拠が見当たらない`);
        removed.push(t);
        issues.push(`derivedTags の根拠不明: ${t}`);
      }
    }
    if (derivedTags.length === 0) {
      evidenceLines.push('derivedTags なし');
    }

    // --- ステップ3：キャラ ---
    let charReason = '';
    if (!characterName) {
      const candidates = collectNameCandidates(commentText);
      if (candidates.length > 0) {
        issues.push(`コメントに人物名らしき記載あり（例: ${candidates.join('、')}）だが characterName が null`);
        charReason = `characterName は null。コメント中に人物名候補（${candidates.join('、')}）が見えるため要確認。`;
      } else {
        charReason = 'characterName は null。コメントに明確な人物名の明記は見当たらないため問題なし。';
      }
    } else {
      const sameAsTitle = normalizeForMatch(characterName) === normalizeForMatch(title);
      const appearsSomewhere = includesNormalized(commentText, characterName) || includesNormalized(title, characterName);
      if (sameAsTitle) {
        issues.push('characterName がタイトル文字列と同一');
      }
      if (!appearsSomewhere) {
        issues.push(`characterName（${characterName}）がタイトル/コメントに見当たらない`);
      }
      charReason = `characterName は「${characterName}」。${sameAsTitle ? 'タイトルそのものになっていないか要確認。' : ''}${appearsSomewhere ? 'コメント/タイトル上の記載と整合。' : '記載根拠が見当たらず要確認。'}`;
    }

    // 余分タグ（かなり保守的に：派生のみ対象）
    // derivedTags は上で根拠不明なら removed に入っている。

    const needsHuman = issues.length > 0 || added.length > 0 || removed.length > 0;

    const titleReasonParts: string[] = [];
    if (missingFromTitle.length === 0) {
      titleReasonParts.push('タイトル内の主要語について、現状タグ（official+derived）で大きな不足は見当たらない。');
    } else {
      titleReasonParts.push(`タイトル語の不足あり（例: ${missingFromTitle.slice(0, 8).join('、')}${missingFromTitle.length > 8 ? '…' : ''}）。`);
    }
    if (hasSeriesHint) {
      titleReasonParts.push('タイトルに番号/続編/総集などの示唆あり。');
    }

    const item: OutputItem = {
      workId,
      title,
      result: needsHuman ? '人間による確認が必要' : 'タグ済',
      checkReasoning: {
        タイトル照合: titleReasonParts.join(' '),
        各タグ根拠: evidenceLines.join('\n'),
        キャラ: charReason,
      },
    };

    if (needsHuman) {
      if (issues.length > 0) item.issues = uniq(issues);
      const tagChanges: OutputItem['tagChanges'] = {};
      if (added.length > 0) tagChanges.added = uniq(added).filter((t) => allTagSet.has(t));
      if (removed.length > 0) tagChanges.removed = uniq(removed);
      if (tagChanges.added?.length || tagChanges.removed?.length) item.tagChanges = tagChanges;
      // newProposal は保守的に出さない（必要なら人間確認で追加）
    }

    output.push(item);
  }

  // 漏れチェック（workId 1回ずつ）
  const inputIds = parsed.works.map((w) => w.workId);
  const outIds = output.map((o) => o.workId);
  assert.strictEqual(output.length, parsed.works.length, `件数不一致: input=${parsed.works.length} output=${output.length}`);
  const missing = inputIds.filter((id) => !outIds.includes(id));
  const extra = outIds.filter((id) => !inputIds.includes(id));
  assert.strictEqual(missing.length, 0, `出力に無い workId: ${missing.slice(0, 10).join(', ')}`);
  assert.strictEqual(extra.length, 0, `入力に無い workId が出力に混入: ${extra.slice(0, 10).join(', ')}`);
  const dupes = outIds.filter((id, idx) => outIds.indexOf(id) !== idx);
  assert.strictEqual(dupes.length, 0, `workId 重複: ${uniq(dupes).slice(0, 10).join(', ')}`);

  // tagChanges.added の制約チェック
  for (const o of output) {
    for (const t of o.tagChanges?.added ?? []) {
      if (!allTagSet.has(t)) {
        throw new Error(`tagChanges.added が allTags(s/a/b) 外: workId=${o.workId} tag=${t} (hash=${hashShort(t)})`);
      }
    }
  }

  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(OUT_RESULT_PATH, json, 'utf-8');
  fs.writeFileSync(OUT_PENDING_PATH, json, 'utf-8');

  console.error(`生成OK: ${output.length}件`);
  console.error(`保存: ${path.relative(root, OUT_RESULT_PATH)}`);
  console.error(`保存: ${path.relative(root, OUT_PENDING_PATH)}`);
}

main();

