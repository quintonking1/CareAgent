import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Lets a verification build run beside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
