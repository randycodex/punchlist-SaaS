import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import PersistentTopBar from "@/components/PersistentTopBar";
import Script from "next/script";

export const metadata: Metadata = {
  title: "PunchList",
  description: "Construction inspection app for architects",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PunchList",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var root = document.documentElement;
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  root.classList.add('dark');
                } else {
                  root.classList.remove('dark');
                }
              } catch (e) {}
            })();
          `}
        </Script>
        <Script id="disable-pwa-cache" strategy="beforeInteractive">
          {`
            (function () {
              if (!('serviceWorker' in navigator)) return;

              window.addEventListener('load', function () {
                navigator.serviceWorker.getRegistrations().then(function (registrations) {
                  registrations.forEach(function (registration) {
                    registration.unregister();
                  });
                });

                if ('caches' in window) {
                  caches.keys().then(function (keys) {
                    return Promise.all(
                      keys.map(function (key) {
                        return caches.delete(key);
                      })
                    );
                  });
                }
              });
            })();
          `}
        </Script>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased">
        <div className="safe-top-shim" />
        <div className="app-shell">
          <AppProviders>
            <PersistentTopBar />
            {children}
          </AppProviders>
        </div>
      </body>
    </html>
  );
}
