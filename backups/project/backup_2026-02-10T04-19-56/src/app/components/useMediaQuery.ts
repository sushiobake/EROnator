'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT_PX = 768;

export function useMediaQuery(maxWidthPx: number = MOBILE_BREAKPOINT_PX): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    setMatches(mq.matches);
    const handler = () => setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [maxWidthPx]);

  return matches;
}
