'use client';

/**
 * SPA 遷移では document.referrer が「直前のページ」にならないため、
 * pathname 変化から直前 URL を sessionStorage に残し、流入記録に渡す。
 */

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const STORAGE_INTERNAL = 'eronator.trafficInternalFrom';
const STORAGE_ENTRY = 'eronator.trafficEntrySnapshot';

export function TrafficAttributionTracker() {
  const pathname = usePathname();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search ?? '';
    const pathWithSearch = `${pathname}${search}`;

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
  }, [pathname]);

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

export function clearTrafficInternalFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_INTERNAL);
  } catch {
    /* ignore */
  }
}
