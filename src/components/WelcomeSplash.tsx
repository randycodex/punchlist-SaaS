'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const SPLASH_DURATION_MS = 1000;
const MIN_HIDDEN_TO_SHOW_MS = 1500;

export default function WelcomeSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  const showSplash = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, SPLASH_DURATION_MS);
  }, []);

  useEffect(() => {
    showSplash();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (!hiddenAt) return;

      const hiddenDuration = Date.now() - hiddenAt;
      if (hiddenDuration >= MIN_HIDDEN_TO_SHOW_MS) {
        showSplash();
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        showSplash();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [showSplash]);

  return (
    <>
      {children}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[120] flex items-center justify-center transition-opacity duration-300 ${
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <Image
          src="/uai-logo.png"
          alt="UAI Logo"
          width={220}
          height={120}
          priority
          className="h-20 w-auto object-contain"
        />
      </div>
    </>
  );
}
