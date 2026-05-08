import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import RootShell from "@/components/RootShell";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkSignInUrl, clerkSignUpUrl, isClerkConfigured } from "@/lib/auth/clerkConfig";

const SHOULD_CLEANUP_PWA = process.env.NEXT_PUBLIC_PWA_DISABLE === "true";

export const metadata: Metadata = {
  title: "Punchlist",
  description: "Construction inspection app for architects",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Punchlist",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#191c1f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var root = document.documentElement;
                try { localStorage.removeItem('punchlist:theme-mode'); } catch (e) {}
                var storedMode = 'system';
                var useDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                root.dataset.themeMode = storedMode;
                if (useDark) {
                  root.classList.add('dark');
                } else {
                  root.classList.remove('dark');
                }
              } catch (e) {}
            })();
          `}
        </Script>
        {SHOULD_CLEANUP_PWA ? (
          <Script id="pwa-cleanup" strategy="beforeInteractive">
            {`
              (function () {
                if (!('serviceWorker' in navigator) || !('localStorage' in window)) return;
                var cleanupKey = 'punchlist:pwa-cleanup-v1';
                try {
                  if (localStorage.getItem(cleanupKey) === 'done') return;
                } catch (e) {}

                window.addEventListener('load', function () {
                  var unregisterPromise = navigator.serviceWorker.getRegistrations().then(function (registrations) {
                    return Promise.all(
                      registrations.map(function (registration) {
                        return registration.unregister();
                      })
                    );
                  });

                  var cacheCleanupPromise = Promise.resolve();
                  if ('caches' in window) {
                    cacheCleanupPromise = caches.keys().then(function (keys) {
                      var staleKeys = keys.filter(function (key) {
                        return key.indexOf('workbox') !== -1 || key.indexOf('precache') !== -1 || key.indexOf('runtime') !== -1;
                      });
                      return Promise.all(
                        staleKeys.map(function (key) {
                          return caches.delete(key);
                        })
                      );
                    });
                  }

                  Promise.all([unregisterPromise, cacheCleanupPromise]).finally(function () {
                    try {
                      localStorage.setItem(cleanupKey, 'done');
                    } catch (e) {}
                  });
                });
              })();
            `}
          </Script>
        ) : null}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased">
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );

  if (!isClerkConfigured) {
    return page;
  }

  return (
    <ClerkProvider
      signInUrl={clerkSignInUrl}
      signUpUrl={clerkSignUpUrl}
    >
      {page}
    </ClerkProvider>
  );
}
