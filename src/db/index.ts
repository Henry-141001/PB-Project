/**
 * Database client.
 * - With DATABASE_URL set (Neon / Vercel): connects to Neon Postgres over HTTP.
 * - Without it (your laptop): uses PGlite, a real Postgres stored in ./.pglite,
 *   so you can develop and test before you have a Neon database.
 * The client is created on first use, not on import, so builds never open the database.
 */
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

type DB = NeonHttpDatabase<typeof schema>;

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon(neon(url), { schema });
  // Both drivers expose the same query builder; we only use features they share (no transactions).
  return drizzlePglite(new PGlite(process.env.PGLITE_DIR ?? "./.pglite"), { schema }) as unknown as DB;
}

const holder = globalThis as unknown as { __pbDb?: DB };
const real = () => (holder.__pbDb ??= create());

export const db = new Proxy({} as DB, {
  get(_, prop) {
    const target = real();
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export { schema };
