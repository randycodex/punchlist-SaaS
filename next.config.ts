import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Keep production builds on Webpack for stability.
};

export default withPWA(nextConfig);
