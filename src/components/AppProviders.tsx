'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { GoogleAuthProvider } from '@/contexts/GoogleAuthContext';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GoogleAuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </GoogleAuthProvider>
  );
}
