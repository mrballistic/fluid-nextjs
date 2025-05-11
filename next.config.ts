import type { NextConfig } from "next";

const repoName = 'fluid-nextjs'; // Replace with your GitHub repo name

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    resolveAlias: {
      // Ensure proper module resolution
      '@': './src'
    }
  },
  basePath: `/${repoName}`,
  assetPrefix: `/${repoName}`,
  reactStrictMode: true,
  output: 'export', // for static export
};

export default nextConfig;
