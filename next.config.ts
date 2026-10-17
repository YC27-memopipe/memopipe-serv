import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite (Postgres embarqué, utilisé en local sans DATABASE_URL) charge un binaire WASM : pas de bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
