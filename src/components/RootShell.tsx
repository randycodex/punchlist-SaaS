'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AppProviders from '@/components/AppProviders';
import PersistentTopBar from '@/components/PersistentTopBar';

export default function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPrivateApp = pathname === '/app' || pathname.startsWith('/app/');

  if (!isPrivateApp) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="safe-top-shim" />
      <div className="app-shell">
        <AppProviders>
          <PersistentTopBar />
          {children}
        </AppProviders>
      </div>
    </>
  );
}
