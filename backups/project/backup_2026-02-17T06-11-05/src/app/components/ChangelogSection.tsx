/**
 * 更新履歴表示コンポーネント
 * PC: 白板右下、スマホ: キャンバス下エリアで使用
 */

'use client';

import { useState, useEffect } from 'react';

interface ChangelogEntry {
  date: string;
  text: string;
}

interface AppInfo {
  version: string;
  changelog: ChangelogEntry[];
}

interface ChangelogSectionProps {
  /** PC用: 右下にコンパクト表示。スマホ用: 縦に広く */
  variant?: 'pc' | 'mobile';
  /** スマホでtrueのとき、バージョンは表示しない（白板内で別表示するため） */
  hideVersion?: boolean;
}

export function ChangelogSection({ variant = 'pc', hideVersion = false }: ChangelogSectionProps) {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    fetch('/api/app-info')
      .then(res => res.ok ? res.json() : null)
      .then((data: AppInfo | null) => data && setInfo(data))
      .catch(() => {});
  }, []);

  if (!info) return null;

  const isMobile = variant === 'mobile';
  const versionSize = isMobile ? 14 : 15;
  const changelogSize = isMobile ? 12 : 12;
  const textColor = isMobile ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)';

  /** スマホ用：控えめなパネル（プレイ画面を邪魔しない） */
  const mobilePanelStyle: React.CSSProperties = isMobile
    ? {
        background: 'rgba(0,0,0,0.25)',
        color: 'rgba(255,255,255,0.85)',
        borderRadius: 8,
        padding: '10px 12px',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: 'none',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }
    : {};

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'stretch' : 'flex-end',
        gap: isMobile ? 6 : 0,
        marginTop: isMobile ? 12 : 0,
        width: isMobile ? '100%' : undefined,
        maxWidth: isMobile ? '100%' : 360,
      }}
    >
      {!hideVersion && (
        <div
          style={{
            fontSize: versionSize,
            fontWeight: 700,
            color: isMobile ? textColor : 'var(--color-text)',
            alignSelf: isMobile ? 'stretch' : 'flex-end',
          }}
        >
          {info.version}
        </div>
      )}
      {isMobile ? null : (
        <div style={{ marginTop: 14, fontWeight: 700, marginBottom: 4, color: 'var(--color-text)', alignSelf: 'flex-end' }}>
          更新履歴
        </div>
      )}
      <div
        style={{
          fontSize: changelogSize,
          color: textColor,
          lineHeight: 1.5,
          maxHeight: isMobile ? 120 : 200,
          overflowY: 'auto',
        width: isMobile ? '100%' : undefined,
        alignSelf: isMobile ? 'stretch' : 'flex-end',
        boxSizing: 'border-box',
        minWidth: 0,
        maxWidth: isMobile ? '100%' : undefined,
        ...mobilePanelStyle,
      }}
      >
        {isMobile && (
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.9)', fontSize: 11 }}>
            更新履歴
          </div>
        )}
        <ul style={{ margin: 0, paddingLeft: isMobile ? 18 : 0, listStylePosition: 'outside' }}>
          {info.changelog.map((entry, i) => {
            const lines = entry.text.split('\n');
            const firstLine = lines[0] ?? '';
            const restLines = lines.slice(1).join('\n');
            return (
              <li
                key={i}
                style={{
                  marginBottom: 10,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <span style={{ flexShrink: 0, fontWeight: 600, opacity: 0.95, color: isMobile ? 'rgba(255,255,255,0.85)' : undefined }}>
                  {entry.date}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: isMobile ? 'rgba(255,255,255,0.9)' : 'var(--color-text)' }}>
                    {firstLine}
                  </span>
                  {restLines ? (
                    <span
                      style={{
                        whiteSpace: 'pre-wrap',
                        display: 'block',
                        fontWeight: 600,
                        marginTop: 2,
                        color: isMobile ? 'rgba(255,255,255,0.8)' : 'var(--color-text)',
                      }}
                    >
                      {restLines}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
