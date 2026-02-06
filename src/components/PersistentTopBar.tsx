'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';

export default function PersistentTopBar() {
  const pathname = usePathname();
  const { isReady, isSignedIn, signIn, signOut } = useMicrosoftAuth();
  const showAuth = pathname === '/';

  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pt-[env(safe-area-inset-top)]">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/uai-logo.png"
            alt="UAI Logo"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">PunchList</h1>
        </div>
        {showAuth && isReady && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
