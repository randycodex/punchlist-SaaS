'use client';

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'needs-auth' | 'error';

type SyncStatusContextValue = {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');

  const value = useMemo(() => ({ status, setStatus }), [status]);

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  }
  return context;
}
