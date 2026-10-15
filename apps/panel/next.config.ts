import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ["@seker/auth", "@seker/shared", "@seker/db"],
  experimental: {
    // Harcama CSV'si en fazla 2 MB (actions/marketing.ts). Multipart zarfı için sınırın biraz üstü.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
