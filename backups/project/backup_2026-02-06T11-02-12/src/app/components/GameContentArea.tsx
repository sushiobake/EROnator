/**
 * ゲーム画面のコンテンツエリア：キャラの直右に台詞・質問・正解を固定距離で配置
 * （アキネイターのようにキャラとセリフの距離が常に一定で、離れない）
 */

'use client';

import {
  CONTENT_OFFSET_LEFT_PX,
  WHITEBOARD_MAX_WIDTH_PX,
  WHITEBOARD_PADDING_PX,
  WHITEBOARD_BORDER_RADIUS_PX,
} from './gameLayoutConstants';

interface GameContentAreaProps {
  children: React.ReactNode;
}

export function GameContentArea({ children }: GameContentAreaProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* キャラゾーン＋固定ギャップ（ここまででコンテンツの左端が決まる） */}
      <div style={{ width: CONTENT_OFFSET_LEFT_PX, flexShrink: 0 }} aria-hidden />
      {/* ホワイトボードは常にキャラの直右（flex-start で距離を固定、中央にしない） */}
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          padding: '32px 32px 32px 0',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: WHITEBOARD_MAX_WIDTH_PX,
            backgroundColor: '#fff',
            borderRadius: WHITEBOARD_BORDER_RADIUS_PX,
            padding: WHITEBOARD_PADDING_PX,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
