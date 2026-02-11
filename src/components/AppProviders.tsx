'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MicrosoftAuthProvider } from '@/contexts/MicrosoftAuthContext';
import WelcomeSplash from '@/components/WelcomeSplash';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MicrosoftAuthProvider>
      <ThemeProvider>
        <WelcomeSplash>{children}</WelcomeSplash>
      </ThemeProvider>
    </MicrosoftAuthProvider>
  );
}
