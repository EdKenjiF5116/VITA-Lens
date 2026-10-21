import path from "node:path";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export type DB = PgliteDatabase<typeof schema>;

const g = globalThis as unknown as { __vitaLensDb?: Promise<DB> };
const migrationsFolder = path.join(process.cwd(), "drizzle");

async function initPglite(): Promise<DB> {
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return db;
}

async function initPostgres(url: string): Promise<DB> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = drizzle(new Pool({ connectionString: url }), { schema });
  await migrate(db, { migrationsFolder });
  // As duas implementações expõem a mesma API de consulta do Drizzle.
  return db as unknown as DB;
}

/**
 * Banco da aplicação. Sem DATABASE_URL, usa PostgreSQL embutido (PGlite)
 * salvo em .data/pglite, sem instalar nada. Com DATABASE_URL, usa um
 * PostgreSQL de verdade. Na primeira execução carrega os dados de demonstração.
 */
export function getDb(): Promise<DB> {
  if (!g.__vitaLensDb) {
    g.__vitaLensDb = (async () => {
      const url = process.env.DATABASE_URL;
      const db = url ? await initPostgres(url) : await initPglite();
      if (process.env.VITA_SKIP_SEED !== "1") await seedIfEmpty(db);
      return db;
    })().catch((e) => {
      g.__vitaLensDb = undefined;
      throw e;
    });
  }
  return g.__vitaLensDb;
}

export { schema };
