'use client';

/**
 * SPA 遷移では document.referrer が「直前のページ」にならないため、
 * pathname 変化から直前 URL を sessionStorage に残し、流入記録に渡す。
 * ?r / ?ct は初回ランディング後のサイト内遷移でも保持する。
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

const STORAGE_INTERNAL = 'eronator.trafficInternalFrom';
const STORAGE_ENTRY = 'eronator.trafficEntrySnapshot';
export const STORAGE_TRAFFIC_R = 'eronator.r';
export const STORAGE_TRAFFIC_CT = 'eronator.ct';

const MAX_R_LEN = 32;
const MAX_CT_LEN = 128;

function persistShortParamsFromSearch(search: string): void {
  if (typeof window === 'undefined') return;
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (q.length === 0) return;
  try {
    const sp = new URLSearchParams(q);
    if (sp.has('r')) {
      const rv = (sp.get('r') ?? '').trim().slice(0, MAX_R_LEN);
      if (rv) {
        sessionStorage.setItem(STORAGE_TRAFFIC_R, rv);
      } else {
        sessionStorage.removeItem(STORAGE_TRAFFIC_R);
      }
      if (!sp.has('ct')) {
        sessionStorage.removeItem(STORAGE_TRAFFIC_CT);
      }
    }
    if (sp.has('ct')) {
      const cv = (sp.get('ct') ?? '').trim().slice(0, MAX_CT_LEN);
      if (cv) {
        sessionStorage.setItem(STORAGE_TRAFFIC_CT, cv);
      } else {
        sessionStorage.removeItem(STORAGE_TRAFFIC_CT);
      }
    }
  } catch {
    /* ignore */
  }
}

export function TrafficAttributionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevRef = useRef<string | null>(null);
  const searchString = searchParams.toString();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = searchString ? `?${searchString}` : '';
    const pathWithSearch = `${pathname}${search}`;

    persistShortParamsFromSearch(search);

    try {
      if (sessionStorage.getItem(STORAGE_ENTRY) == null) {
        sessionStorage.setItem(
          STORAGE_ENTRY,
          JSON.stringify({
            referrer: document.referrer || '',
            landing: pathWithSearch,
            ts: Date.now(),
          })
        );
      }
    } catch {
      /* ignore */
    }

    const prev = prevRef.current;
    if (prev != null && prev !== pathWithSearch) {
      try {
        sessionStorage.setItem(STORAGE_INTERNAL, prev);
      } catch {
        /* ignore */
      }
    }
    prevRef.current = pathWithSearch;
  }, [pathname, searchString]);

  return null;
}

export function readTrafficInternalFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_INTERNAL);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function readTrafficShortCodeFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_TRAFFIC_R);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function readTrafficCampaignTagFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_TRAFFIC_CT);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearTrafficInternalFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_INTERNAL);
  } catch {
    /* ignore */
  }
}

export function clearTrafficShortParamsFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_TRAFFIC_R);
    sessionStorage.removeItem(STORAGE_TRAFFIC_CT);
  } catch {
    /* ignore */
  }
}
