'use client';

import { useState, useEffect } from 'react';
import { ExternalLink } from './ExternalLink';
import { useMediaQuery } from './useMediaQuery';

type TagOption = { tagKey: string; displayName: string; count: number };
type GroupedTags = Record<string, TagOption[]>;
type WorkResult = {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
  reviewAverage?: number | null;
  reviewCount?: number | null;
  matchRate: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  genre: 'ジャンル',
  play: 'プレイ内容',
  situation: 'シチュエーション',
  character: 'キャラクター',
  body: '体型・容姿',
  other: 'その他',
};

interface RecommendModeProps {
  onBack: () => void;
}

export function RecommendMode({ onBack }: RecommendModeProps) {
  const isMobile = useMediaQuery(768);
  const [step, setStep] = useState<'select' | 'loading' | 'results'>('select');
  const [tags, setTags] = useState<GroupedTags>({});
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [popular, setPopular] = useState<WorkResult[]>([]);
  const [hidden, setHidden] = useState<WorkResult[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [tagsLoading, setTagsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/recommend')
      .then(r => r.json())
      .then(data => {
        if (data.success) setTags(data.tags);
      })
      .catch(() => {})
      .finally(() => setTagsLoading(false));
  }, []);

  const toggleTag = (tagKey: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) next.delete(tagKey);
      else next.add(tagKey);
      return next;
    });
  };

  const handleSearch = async () => {
    if (selectedTags.size === 0) return;
    setStep('loading');
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagKeys: Array.from(selectedTags) }),
      });
      const data = await res.json();
      if (data.success) {
        setPopular(data.popular || []);
        setHidden(data.hidden || []);
        setTotalMatched(data.totalMatched || 0);
        setStep('results');
      }
    } catch {
      setStep('select');
    }
  };

  if (step === 'loading') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>あなたにぴったりの作品を探しています…</p>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div style={{ padding: isMobile ? 16 : 24, maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24 }}>おすすめ作品</h2>
          <button onClick={() => { setStep('select'); setPopular([]); setHidden([]); }} style={btnStyle(isMobile)}>
            選び直す
          </button>
        </div>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
          {totalMatched}件の候補から厳選しました
        </p>

        {popular.length > 0 && (
          <>
            <h3 style={{ fontSize: isMobile ? 16 : 18, marginBottom: 12 }}>人気のおすすめ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {popular.map(w => <WorkCard key={w.workId} work={w} isMobile={isMobile} />)}
            </div>
          </>
        )}

        {hidden.length > 0 && (
          <>
            <h3 style={{ fontSize: isMobile ? 16 : 18, marginBottom: 12 }}>隠れた名作</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {hidden.map(w => <WorkCard key={w.workId} work={w} isMobile={isMobile} />)}
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={onBack} style={btnStyle(isMobile)}>トップに戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24 }}>好みを教えて</h2>
        <button onClick={onBack} style={btnStyle(isMobile)}>戻る</button>
      </div>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
        気になるタグを選んでください（複数OK）
      </p>

      {tagsLoading ? (
        <p>読み込み中…</p>
      ) : (
        Object.entries(tags).map(([cat, catTags]) => {
          if (catTags.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, color: '#555', marginBottom: 8 }}>{CATEGORY_LABELS[cat] || cat}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {catTags.map(tag => (
                  <button
                    key={tag.tagKey}
                    onClick={() => toggleTag(tag.tagKey)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 13,
                      borderRadius: 20,
                      border: selectedTags.has(tag.tagKey) ? '2px solid #7c3aed' : '1px solid #ddd',
                      backgroundColor: selectedTags.has(tag.tagKey) ? '#ede9fe' : '#fff',
                      color: selectedTags.has(tag.tagKey) ? '#7c3aed' : '#333',
                      cursor: 'pointer',
                      fontWeight: selectedTags.has(tag.tagKey) ? 600 : 400,
                    }}
                  >
                    {tag.displayName}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}

      {selectedTags.size > 0 && (
        <div style={{ position: 'sticky', bottom: 16, textAlign: 'center', padding: 12 }}>
          <button
            onClick={handleSearch}
            style={{
              padding: '14px 48px',
              fontSize: 17,
              fontWeight: 700,
              backgroundColor: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
            }}
          >
            {selectedTags.size}個のタグで検索
          </button>
        </div>
      )}
    </div>
  );
}

function WorkCard({ work, isMobile }: { work: WorkResult; isMobile: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <img
        src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
        alt={work.title}
        style={{ width: isMobile ? 70 : 90, height: 'auto', borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: isMobile ? 14 : 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {work.title}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>{work.authorName}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>一致度 {work.matchRate}%</span>
          {work.reviewAverage != null && work.reviewCount != null && work.reviewCount > 0 && (
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
              ★{work.reviewAverage.toFixed(1)}（{work.reviewCount}件）
            </span>
          )}
          <ExternalLink href={work.productUrl} linkText="読んでみる">
            <span style={{
              display: 'inline-block',
              padding: '4px 12px',
              backgroundColor: '#ff6b35',
              color: '#fff',
              fontWeight: 600,
              fontSize: 11,
              borderRadius: 6,
              textDecoration: 'none',
            }}>
              読んでみる
            </span>
          </ExternalLink>
        </div>
      </div>
    </div>
  );
}

function btnStyle(isMobile: boolean): React.CSSProperties {
  return {
    padding: isMobile ? '8px 16px' : '10px 20px',
    fontSize: isMobile ? 13 : 14,
    fontWeight: 600,
    backgroundColor: '#f3f4f6',
    color: '#333',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
  };
}
