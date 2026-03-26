'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
import { getProject } from '@/lib/db';

export default function PersistentTopBar() {
  const pathname = usePathname();
  const { isReady, isSignedIn, signIn, signOut } = useMicrosoftAuth();
  const { status } = useSyncStatus();
  const showAuth = pathname === '/';
  const [projectTitle, setProjectTitle] = useState('');

  const indicatorClasses = {
    idle: 'opacity-0 bg-green-500 dark:bg-green-400',
    syncing: 'opacity-100 bg-green-500 dark:bg-green-400 animate-pulse',
    pending: 'opacity-100 bg-amber-500 dark:bg-amber-400',
    'needs-auth': 'opacity-100 bg-amber-500 dark:bg-amber-400',
    error: 'opacity-100 bg-red-500 dark:bg-red-400',
  } as const;

  const indicatorLabel = {
    idle: 'No sync activity',
    syncing: 'Syncing now',
    pending: 'Sync pending',
    'needs-auth': 'Sign in required to finish syncing',
    error: 'Sync needs attention',
  } as const;

  useEffect(() => {
    let cancelled = false;

    async function loadProjectTitle() {
      if (!pathname.startsWith('/project/')) {
        if (!cancelled) setProjectTitle('');
        return;
      }

      const segments = pathname.split('/').filter(Boolean);
      const projectId = segments[1];
      if (!projectId) {
        if (!cancelled) setProjectTitle('');
        return;
      }

      try {
        const project = await getProject(projectId);
        if (!cancelled) {
          setProjectTitle(project?.projectName ?? '');
        }
      } catch {
        if (!cancelled) {
          setProjectTitle('');
        }
      }
    }

    void loadProjectTitle();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="persistent-top-bar fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pt-[env(safe-area-inset-top)]">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Go to projects" className="flex items-center">
            <Image
              src="/uai-logo.png"
              alt="UAI Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </Link>
        </div>
        {showAuth && isReady && (
          <div className="flex items-center gap-2">
            <span
              aria-label={indicatorLabel[status]}
              className={`sync-indicator h-2.5 w-2.5 rounded-full ${indicatorClasses[status]}`}
            />
            {!isSignedIn ? (
              <button
                onClick={signIn}
                className="h-9 px-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Sign in
              </button>
            ) : (
              <button
                onClick={signOut}
                className="h-9 px-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Sign out
              </button>
            )}
          </div>
        )}
        {!showAuth && projectTitle && (
          <div className="max-w-[60vw] flex items-center justify-end gap-2">
            <span
              aria-label={indicatorLabel[status]}
              className={`sync-indicator h-2.5 w-2.5 rounded-full shrink-0 ${indicatorClasses[status]}`}
            />
            <div className="truncate text-right text-sm font-medium text-gray-700 dark:text-gray-200">
              {projectTitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
