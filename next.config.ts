import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  // A separate verification build must not overwrite an active next dev session.
  distDir: process.env.MEMOPIPE_DIST_DIR || ".next",
  async redirects() { return [{ source: "/demo/:path*", destination: "/nimbus/:path*", permanent: false }]; },
  // PGlite (Postgres embarqué, utilisé en local sans DATABASE_URL) charge un binaire WASM : pas de bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
