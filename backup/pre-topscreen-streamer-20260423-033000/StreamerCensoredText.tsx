/**
 * 配信者モード用: エロワード部分を部分的伏字＋スタイルで表示
 * マッチした部分だけ partialCensor を適用し、.streamer-censored でラップ
 */

'use client';

import React from 'react';
import { partialCensor, DEFAULT_EROTIC_WORDS } from '@/app/utils/streamerCensor';

/** 長い順にソート */
function sortByLengthDesc(words: string[]): string[] {
  return [...words].sort((a, b) => b.length - a.length);
}

/** 「...」から始まる 系のパターン。括弧内を常に●〇●（中間だけ伏字、エロワードかどうか問わず） */
const TITLE_INITIAL_PATTERN = /「([^」]{1,10})」から始ま(る|りますか|るか)[？?]?/;

interface StreamerCensoredTextProps {
  text: string;
  eroticWords?: string[];
  /** true のとき全文を部分的伏字（タイトル・頭3文字用） */
  censorAll?: boolean;
  /** 質問文用：伏字部分をさらに小さく・別クラス */
  inQuestion?: boolean;
}

/**
 * テキスト内のエロワードを部分的伏字にし、該当部分を .streamer-censored でスタイル適用。
 * censorAll 時は全文を partialCensor（タイトル・頭3文字など）
 * 「XXX」から始まる の XXX 部分は常に partialCensor（エロワードリストに依存しない）
 */
export function StreamerCensoredText({ text, eroticWords = DEFAULT_EROTIC_WORDS, censorAll = false, inQuestion = false }: StreamerCensoredTextProps) {
  const censoredClass = inQuestion ? 'streamer-censored streamer-censored-in-question' : 'streamer-censored';

  if (censorAll) {
    return <span className={censoredClass}>{partialCensor(text)}</span>;
  }

  // タイトル頭N文字質問：「XXX」から始まる の XXX を常に部分的伏字（エロワードかどうか問わず）
  const titleMatch = text.match(TITLE_INITIAL_PATTERN);
  if (titleMatch) {
    const before = text.slice(0, titleMatch.index!);
    const quoted = titleMatch[1];
    const suffix = titleMatch[0].slice(quoted.length + 2); // 「」 の分
    return (
      <>
        {before}
        「<span className={censoredClass}>{partialCensor(quoted)}</span>」{suffix}
      </>
    );
  }
  const sorted = sortByLengthDesc(eroticWords.filter(Boolean));
  if (sorted.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliestMatch: { word: string; index: number } | null = null;

    for (const word of sorted) {
      const idx = remaining.indexOf(word);
      if (idx >= 0 && (earliestMatch === null || idx < earliestMatch.index)) {
        earliestMatch = { word, index: idx };
      }
    }

    if (earliestMatch === null) {
      parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }

    if (earliestMatch.index > 0) {
      parts.push(<React.Fragment key={key++}>{remaining.slice(0, earliestMatch.index)}</React.Fragment>);
    }
    parts.push(
      <span key={key++} className={censoredClass}>
        {partialCensor(earliestMatch.word)}
      </span>
    );
    remaining = remaining.slice(earliestMatch.index + earliestMatch.word.length);
  }

  return <>{parts}</>;
}
