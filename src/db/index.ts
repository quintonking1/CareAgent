import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

// `file` may be ":memory:" for tests.
export function createDb(file: string) {
  const sqlite = new Database(file);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

const globalForDb = globalThis as unknown as { __db?: Db };

// Vercel's filesystem is read-only except /tmp, so default there when deployed (state resets per instance).
const defaultDbFile = () => (process.env.VERCEL ? "/tmp/careagent.db" : "careagent.db");

export function getDb(): Db {
  globalForDb.__db ??= createDb(process.env.DATABASE_URL ?? defaultDbFile());
  return globalForDb.__db;
}

export { schema };
