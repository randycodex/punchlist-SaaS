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

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
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

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response?.access_token) {
          setAccessToken(response.access_token);
        }
      },
    });
  }, [isReady, clientId]);

  function signIn() {
    tokenClientRef.current?.requestAccessToken();
  }

  function signOut() {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        setAccessToken(null);
      });
    } else {
      setAccessToken(null);
    }
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
