'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { PublicClientApplication, type AccountInfo, type AuthenticationResult } from '@azure/msal-browser';

type MicrosoftAuthContextValue = {
  accessToken: string | null;
  isSignedIn: boolean;
  isReady: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  ensureAccessToken: () => Promise<string | null>;
};

const MicrosoftAuthContext = createContext<MicrosoftAuthContextValue | undefined>(undefined);

const SCOPES = ['User.Read', 'Files.ReadWrite'];

export function MicrosoftAuthProvider({ children }: { children: ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_MS_CLIENT_ID ?? '';
  const tenantId = process.env.NEXT_PUBLIC_MS_TENANT_ID ?? '';
  const redirectUriFromEnv = process.env.NEXT_PUBLIC_MS_REDIRECT_URI ?? '';
  const redirectUri =
    redirectUriFromEnv || (typeof window !== 'undefined' ? `${window.location.origin}/` : '');

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const pca = useMemo(() => {
    if (!clientId || !tenantId || !redirectUri) return null;
    return new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    });
  }, [clientId, tenantId, redirectUri]);

  useEffect(() => {
    let active = true;
    if (!pca) {
      setIsReady(true);
      return;
    }

    pca
      .initialize()
      .then(() => pca.handleRedirectPromise())
      .then(async (result: AuthenticationResult | null) => {
        if (!active) return;
        if (result?.account) {
          pca.setActiveAccount(result.account);
        }
        const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
        if (!account) {
          setIsReady(true);
          return;
        }
        const tokenResult = await pca.acquireTokenSilent({ scopes: SCOPES, account });
        if (!active) return;
        setAccessToken(tokenResult.accessToken);
        setIsSignedIn(true);
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [pca]);

  async function signIn() {
    if (!pca) {
      alert('Microsoft sign-in is not configured. Check NEXT_PUBLIC_MS_* environment variables.');
      return;
    }
    try {
      await pca.initialize();
      await pca.loginRedirect({ scopes: SCOPES });
    } catch (error) {
      console.error('Microsoft sign-in failed:', error);
      alert('Microsoft sign-in failed. Please try again.');
    }
  }

  async function signOut() {
    if (!pca) return;
    await pca.initialize();
    await pca.logoutRedirect({ postLogoutRedirectUri: redirectUri || '/' });
    setAccessToken(null);
    setIsSignedIn(false);
  }

  async function ensureAccessToken() {
    if (!pca) return null;
    await pca.initialize();
    const account: AccountInfo | undefined = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
    if (!account) return null;
    try {
      const tokenResult = await pca.acquireTokenSilent({ scopes: SCOPES, account });
      setAccessToken(tokenResult.accessToken);
      setIsSignedIn(true);
      return tokenResult.accessToken;
    } catch {
      return null;
    }
  }

  return (
    <MicrosoftAuthContext.Provider
      value={{
        accessToken,
        isSignedIn,
        isReady,
        signIn,
        signOut,
        ensureAccessToken,
      }}
    >
      {children}
    </MicrosoftAuthContext.Provider>
  );
}

export function useMicrosoftAuth() {
  const context = useContext(MicrosoftAuthContext);
  if (!context) {
    throw new Error('useMicrosoftAuth must be used within a MicrosoftAuthProvider');
  }
  return context;
}
