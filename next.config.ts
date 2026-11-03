import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Lets a verification build run beside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Files read at runtime via fs, which tracing can't discover: DB migrations and fake-service seed data.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./data/fakes/*.json"] },
};

export default config;
