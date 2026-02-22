#!/usr/bin/env tsx
/**
 * check-input.json を読み、指定workIdsのチェック結果を生成する。
 * 指示書(docs/check-instruction.md)に従った3項目チェックを実行。
 *
 * Usage: npx tsx scripts/run-check-batch.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(process.cwd());
const INPUT_PATH = path.join(ROOT, 'data', 'chatgpt-export', 'check-input.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'chatgpt-export', 'check-result-paste.json');

const TARGET_IDS = [
  'd_443461', 'd_460305', 'd_465469', 'd_477806', 'd_491924', 'd_497346', 'd_497347', 'd_498539', 'd_508012', 'd_519056',
  'd_522331', 'd_529884', 'd_539449', 'd_546697', 'd_574103', 'd_583413', 'd_595013', 'd_596884', 'd_601482', 'd_615666',
  'd_615774', 'd_617678', 'd_629679', 'd_639146', 'd_641261', 'd_645780', 'd_646214', 'd_650150', 'd_658863', 'd_659924',
  'd_674651', 'd_678330', 'd_682106', 'd_684057', 'd_685023', 'd_685522', 'd_691780', 'd_697866', 'd_699792', 'd_701217',
  'd_701772', 'd_703039', 'd_703061', 'd_703906', 'd_704636', 'd_705935', 'd_707945', 'd_708850', 'd_712370', 'd_715103',
  'd_722505', 'd_722558', 'd_723285', 'd_724019', 'd_724652', 'd_726247', 'd_728056', 'd_730132', 'd_728346', 'd_732645',
  'd_510860', 'd_338389', 'd_059254', 'd_254370', 'd_512305', 'd_389116', 'd_207654', 'd_227552', 'd_728419', 'd_329539',
  'd_404341', 'd_133342', 'd_165238', 'd_178198', 'd_191809', 'd_193795', 'd_201721', 'd_202313', 'd_202841', 'd_204028',
  'd_222140', 'd_231202', 'd_250538', 'd_257594', 'd_276007', 'd_292161', 'd_327737', 'd_358417', 'd_393335', 'd_442612',
  'd_446351', 'd_450170', 'd_477562', 'd_485377', 'd_494290', 'd_502098', 'd_526298', 'd_528446', 'd_534050', 'd_545635',
];

interface Work {
  workId: string;
  title: string;
  commentText: string;
  derivedTags: string[];
  officialTags: string[];
  characterName: string | null;
}

function hasSubstring(text: string, tag: string): boolean {
  if (!text || !tag) return false;
  return text.includes(tag);
}

function checkWork(work: Work, allTags: { s: string[]; a: string[]; b: string[] }): Record<string, unknown> {
  const combined = [...work.officialTags, ...work.derivedTags];
  const issues: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  let newProposal: string | undefined;

  // 1. タイトル照合
  let titleMatch = '';
  const allTagSet = new Set([...allTags.s, ...allTags.a, ...allTags.b]);
  const titleTerms = work.title.replace(/[「」『』（）\[\]！？、。0-9]/g, ' ').split(/\s+/).filter((t) => t.length >= 2);
  const stopWords = new Set(['の', 'と', 'に', 'を', 'は', 'が', 'で', 'だ', 'し', 'て', 'な', 'も', 'や', 'か', 'れ', 'さ']);
  for (const term of titleTerms) {
    if (stopWords.has(term)) continue;
    const found = combined.some((t) => t.includes(term) || term.includes(t));
    if (!found) {
      const cand = [...allTagSet].find((t) => t.includes(term) || term.includes(t));
      if (cand && !work.officialTags.includes(cand) && !work.derivedTags.includes(cand)) {
        added.push(cand);
        issues.push(`タイトル「${term}」→タグ追加: ${cand}`);
      }
    }
  }
  titleMatch = `タイトル「${work.title}」の語とタグ照合。${added.length ? `不足分追加: ${added.join(', ')}` : '過不足なし'}`;

  // 2. 各derivedタグの根拠
  const tagBasis: string[] = [];
  for (const dt of work.derivedTags) {
    const inTitle = hasSubstring(work.title, dt);
    const inComment = hasSubstring(work.commentText, dt);
    if (inTitle || inComment) {
      tagBasis.push(`${dt}: ${inTitle ? 'タイトル' : ''}${inTitle && inComment ? '・' : ''}${inComment ? 'コメント' : ''}に根拠`);
    } else {
      tagBasis.push(`${dt}: 根拠なし`);
      removed.push(dt);
      issues.push(`derived「${dt}」にタイトル・コメント上根拠なし`);
    }
  }
  const eachTagReason = tagBasis.length ? tagBasis.join('。') : 'derivedなし';

  // 3. キャラ（タイトル＝キャラ名チェック）
  let charReason = '';
  if (work.characterName) {
    const charInTitle = work.title === work.characterName || work.title.includes(work.characterName);
    if (charInTitle && work.characterName.length >= 2) {
      charReason = `characterName「${work.characterName}」がタイトルと同一の可能性。要確認`;
      issues.push('characterNameがタイトル文字列の可能性');
    } else {
      charReason = `characterName「${work.characterName}」設定。コメントに名前があればOK`;
    }
  } else {
    charReason = 'characterName=null。名前が無ければ問題なし';
  }

  const result = issues.length > 0 ? '人間による確認が必要' : 'タグ済';

  const out: Record<string, unknown> = {
    workId: work.workId,
    title: work.title,
    result,
    checkReasoning: {
      'タイトル照合': titleMatch,
      '各タグ根拠': eachTagReason,
      'キャラ': charReason,
    },
  };
  if (result === '人間による確認が必要') {
    out.issues = issues;
    if (added.length > 0 || removed.length > 0) {
      out.tagChanges = { added: [...new Set(added)], removed: [...new Set(removed)] };
    }
    if (newProposal) {
      out.tagSuggestions = { newProposal };
    }
  }
  return out;
}

function main() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const data = JSON.parse(raw) as { allTags: { s: string[]; a: string[]; b: string[] }; works: Work[] };
  const idSet = new Set(TARGET_IDS);
  const works = data.works.filter((w: Work) => idSet.has(w.workId));

  if (works.length !== TARGET_IDS.length) {
    const found = new Set(works.map((w: Work) => w.workId));
    const missing = TARGET_IDS.filter((id) => !found.has(id));
    console.error('不足workId:', missing);
  }

  const results = works.map((w) => checkWork(w, data.allTags));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`${OUTPUT_PATH} に ${results.length} 件出力しました。`);
}

main();
