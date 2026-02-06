import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import PersistentTopBar from "@/components/PersistentTopBar";
import RouteTransition from "@/components/RouteTransition";

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
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased">
        <div className="safe-top-shim" />
        <div className="app-shell">
          <AppProviders>
            <PersistentTopBar />
            <RouteTransition>{children}</RouteTransition>
          </AppProviders>
        </div>
      </body>
    </html>
  );
}
