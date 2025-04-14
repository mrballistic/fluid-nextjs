import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    resolveAlias: {
      // Ensure proper module resolution
      '@': './src'
    }
  }
};

export default nextConfig;
