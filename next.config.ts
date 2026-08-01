import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components — required for `use cache`/`cacheLife`/`cacheTag` and
  // implements Partial Prerendering by default (proposal.md: file changes).
  // NOTE: the Data Access Layer (a later slice) reads sessions per-request
  // via React `cache()` and must NEVER use the `"use cache"` directive —
  // that directive is cross-request/durable and would keep a revoked
  // session alive. This flag enables the directive project-wide; it does
  // not mandate its use anywhere sessions are involved.
  cacheComponents: true,
};

export default nextConfig;
