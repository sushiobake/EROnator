'use client';

/**
 * 管理画面内で配布先マスタを保持し、ブラウザのローカルストレージへ保存するコンテキスト。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cloneDefaultPromoChannels, type PromoChannelDef } from '@/lib/promoChannelRegistry';

const STORAGE_KEY = 'eronator_promo_channels_custom_v1';

function sanitizeChannelList(raw: unknown): PromoChannelDef[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PromoChannelDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim().toLowerCase() : '';
    if (!id || id.length > 32 || !/^[a-z0-9_-]+$/.test(id)) continue;
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    const snsName = typeof o.snsName === 'string' ? o.snsName.trim() : '';
    if (!label || !snsName) continue;
    const utm = o.utm;
    if (!utm || typeof utm !== 'object') continue;
    const u = utm as Record<string, unknown>;
    const source = typeof u.source === 'string' ? u.source.trim() : '';
    const medium = typeof u.medium === 'string' ? u.medium.trim() : '';
    if (!source || !medium) continue;
    const hint = typeof o.hint === 'string' ? o.hint.trim() : undefined;
    const inheritRaw = o.inheritTemplatesFrom;
    const inheritTemplatesFrom =
      typeof inheritRaw === 'string' && inheritRaw.trim() !== ''
        ? inheritRaw.trim().toLowerCase()
        : undefined;
    let postTemplates: PromoChannelDef['postTemplates'];
    if (Array.isArray(o.postTemplates)) {
      const tpls: NonNullable<PromoChannelDef['postTemplates']> = [];
      for (const t of o.postTemplates) {
        if (!t || typeof t !== 'object') continue;
        const to = t as Record<string, unknown>;
        const tid = typeof to.id === 'string' ? to.id : '';
        const tlabel = typeof to.label === 'string' ? to.label : '';
        const body = typeof to.body === 'string' ? to.body : '';
        if (tid && tlabel && body) tpls.push({ id: tid, label: tlabel, body });
      }
      if (tpls.length > 0) postTemplates = tpls;
    }
    out.push({
      id,
      label,
      snsName,
      utm: { source, medium },
      ...(hint ? { hint } : {}),
      ...(inheritTemplatesFrom ? { inheritTemplatesFrom } : {}),
      ...(postTemplates ? { postTemplates } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

type PromoChannelsContextValue = {
  channels: PromoChannelDef[];
  setChannels: (next: PromoChannelDef[]) => void;
  upsertChannel: (ch: PromoChannelDef) => void;
  removeChannel: (id: string) => void;
  resetToDefaults: () => void;
};

const PromoChannelsContext = createContext<PromoChannelsContextValue | null>(null);

export function PromoChannelsProvider({ children }: { children: ReactNode }) {
  const [channels, setChannelsState] = useState<PromoChannelDef[]>(() => cloneDefaultPromoChannels());
  const hydrated = useRef(false);
  const skipNextPersist = useRef(true);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        const list = sanitizeChannelList(parsed);
        if (list) setChannelsState(list);
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
    skipNextPersist.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
    } catch {
      /* ignore quota */
    }
  }, [channels]);

  const setChannels = useCallback((next: PromoChannelDef[]) => {
    const list = sanitizeChannelList(next);
    setChannelsState(list && list.length > 0 ? list : cloneDefaultPromoChannels());
  }, []);

  const upsertChannel = useCallback((ch: PromoChannelDef) => {
    const id = ch.id.trim().toLowerCase();
    if (!id) return;
    setChannelsState((prev) => {
      const idx = prev.findIndex((c) => c.id.toLowerCase() === id);
      const next = [...prev];
      const normalized: PromoChannelDef = {
        id,
        label: ch.label.trim(),
        snsName: ch.snsName.trim(),
        utm: {
          source: ch.utm.source.trim(),
          medium: ch.utm.medium.trim(),
        },
      };
      if (ch.hint?.trim()) normalized.hint = ch.hint.trim();
      if (ch.inheritTemplatesFrom?.trim()) {
        normalized.inheritTemplatesFrom = ch.inheritTemplatesFrom.trim().toLowerCase();
      }
      if (ch.postTemplates && ch.postTemplates.length > 0 && !normalized.inheritTemplatesFrom) {
        normalized.postTemplates = ch.postTemplates;
      }
      if (idx >= 0) next[idx] = normalized;
      else next.push(normalized);
      return next;
    });
  }, []);

  const removeChannel = useCallback((id: string) => {
    const key = id.trim().toLowerCase();
    setChannelsState((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((c) => c.id.toLowerCase() !== key);
      return filtered.length > 0 ? filtered : prev;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    skipNextPersist.current = true;
    setChannelsState(cloneDefaultPromoChannels());
  }, []);

  const value = useMemo(
    () => ({
      channels,
      setChannels,
      upsertChannel,
      removeChannel,
      resetToDefaults,
    }),
    [channels, setChannels, upsertChannel, removeChannel, resetToDefaults]
  );

  return <PromoChannelsContext.Provider value={value}>{children}</PromoChannelsContext.Provider>;
}

export function usePromoChannels(): PromoChannelsContextValue {
  const ctx = useContext(PromoChannelsContext);
  if (!ctx) {
    throw new Error('usePromoChannels は PromoChannelsProvider 内で使ってください');
  }
  return ctx;
}
