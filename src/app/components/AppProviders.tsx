'use client';

import { Analytics } from '@vercel/analytics/react';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { ToastProvider } from './ToastContext';
import { TrafficAttributionTracker } from './TrafficAttributionTracker';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <TrafficAttributionTracker />
      </Suspense>
      {children}
      <Analytics />
    </ToastProvider>
  );
}
