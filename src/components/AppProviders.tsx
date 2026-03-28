'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MicrosoftAuthProvider } from '@/contexts/MicrosoftAuthContext';
import { SyncStatusProvider } from '@/contexts/SyncStatusContext';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import WelcomeSplash from '@/components/WelcomeSplash';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MicrosoftAuthProvider>
      <SyncStatusProvider>
        <AppSettingsProvider>
          <ThemeProvider>
            <WelcomeSplash>{children}</WelcomeSplash>
          </ThemeProvider>
        </AppSettingsProvider>
      </SyncStatusProvider>
    </MicrosoftAuthProvider>
  );
}
