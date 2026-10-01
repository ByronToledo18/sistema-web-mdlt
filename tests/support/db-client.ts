// Sustituto de server/db/client.ts para los tests (alias en vitest.config.mts).
//
// Cada archivo de test corre en su propio módulo, así que recibe una base
// PGlite (Postgres compilado a WASM, en memoria) con las migraciones de
// drizzle/. Exporta lo mismo que el cliente real: `db` y `withTx`, y los
// servicios no notan la diferencia. Las migraciones terminan dentro de
// resetDb(), que cada archivo llama en su beforeEach.
//
// Limitación: PGlite tiene una sola conexión, así que dos transacciones
// "simultáneas" se ejecutan una detrás de otra. Los tests de concurrencia
// comprueban el resultado (nadie vende la última unidad dos veces), no el
// bloqueo de filas en sí; eso lo cubre el `FOR UPDATE`/`stock >= n` en Neon.

import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import * as schema from "@/server/db/schema"

const client = new PGlite()

export const db = drizzle({ client, schema })

const migrado = migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) })

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type Executor = typeof db

export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn)
}

// Deja todas las tablas vacías y los ids en 1. También borra las secuencias
// por año (códigos de pedido, guías, facturas) que crean los servicios.
export async function resetDb(): Promise<void> {
  await migrado
  const { rows: tables } = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(", ")
    await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))
  }
  const { rows: seqs } = await db.execute<{ relname: string }>(
    sql`SELECT relname FROM pg_class WHERE relkind = 'S'`,
  )
  for (const s of seqs.filter((s) => /_seq_\w*\d{4}$/.test(s.relname))) {
    await db.execute(sql.raw(`DROP SEQUENCE "${s.relname}"`))
  }
}
