declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}

export {};
