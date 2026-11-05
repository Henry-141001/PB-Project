import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite (local database) ships WebAssembly files; load it from node_modules instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Keep Turbopack inside this folder (a stray package-lock.json higher up would otherwise confuse it)
  turbopack: { root: process.cwd() },
};

export default nextConfig;
