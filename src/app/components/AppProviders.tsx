'use client';

import { Analytics } from '@vercel/analytics/react';
import type { ReactNode } from 'react';
import { ToastProvider } from './ToastContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Analytics />
    </ToastProvider>
  );
}
