declare namespace google {
  namespace accounts.oauth2 {
    type TokenResponse = {
      access_token?: string;
      expires_in?: number;
    };

    type TokenClient = {
      requestAccessToken: (options?: { prompt?: string }) => void;
    };

    function initTokenClient(options: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
    }): TokenClient;

    function revoke(token: string, callback: () => void): void;
  }
}

declare global {
  interface Window {
    google?: typeof google;
  }
}

export {};
