'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

type GoogleAuthContextValue = {
  accessToken: string | null;
  isReady: boolean;
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

const GoogleAuthContext = createContext<GoogleAuthContextValue | undefined>(undefined);

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'punchlist-google-token';
const STORAGE_EXP_KEY = 'punchlist-google-token-exp';
const STORAGE_HINT_KEY = 'punchlist-google-signed-in';

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const tokenClientRef = useRef<any>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const interval = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        setIsReady(true);
        window.clearInterval(interval);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [clientId]);

  useEffect(() => {
    if (!isReady || !clientId) return;
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return;

    tokenClientRef.current = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response?.access_token) {
          setAccessToken(response.access_token);
          const expiresIn = response.expires_in ?? 3600;
          const expiresAt = Date.now() + expiresIn * 1000;
          localStorage.setItem(STORAGE_KEY, response.access_token);
          localStorage.setItem(STORAGE_EXP_KEY, String(expiresAt));
          localStorage.setItem(STORAGE_HINT_KEY, 'true');
        }
      },
    });

    const storedToken = localStorage.getItem(STORAGE_KEY);
    const storedExp = Number(localStorage.getItem(STORAGE_EXP_KEY) ?? 0);
    if (storedToken && storedExp > Date.now()) {
      setAccessToken(storedToken);
      return;
    }

    const previouslySignedIn = localStorage.getItem(STORAGE_HINT_KEY) === 'true';
    if (previouslySignedIn) {
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    }
  }, [isReady, clientId]);

  function signIn() {
    tokenClientRef.current?.requestAccessToken();
  }

  function signOut() {
    const oauth2 = window.google?.accounts?.oauth2;
    if (accessToken && oauth2) {
      oauth2.revoke(accessToken, () => {
        setAccessToken(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_EXP_KEY);
        localStorage.removeItem(STORAGE_HINT_KEY);
      });
      return;
    }
    setAccessToken(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXP_KEY);
    localStorage.removeItem(STORAGE_HINT_KEY);
  }

  return (
    <GoogleAuthContext.Provider
      value={{
        accessToken,
        isReady,
        isSignedIn: Boolean(accessToken),
        signIn,
        signOut,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
