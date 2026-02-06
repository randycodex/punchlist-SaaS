'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MicrosoftAuthProvider } from '@/contexts/MicrosoftAuthContext';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MicrosoftAuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </MicrosoftAuthProvider>
  );
}
