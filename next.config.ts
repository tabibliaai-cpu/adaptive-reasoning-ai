import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is for self-hosted Node.js servers.
  // Netlify uses serverless functions — omit output mode.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
