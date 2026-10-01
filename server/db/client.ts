import "server-only"

import { neon, Pool } from "@neondatabase/serverless"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http"
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless"
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core"
import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurado")
}

const connectionString = process.env.DATABASE_URL

// Lecturas y escrituras de una sola sentencia: driver HTTP, sin conexión
// persistente (lo más barato en serverless).
export const db = drizzleHttp({ client: neon(connectionString), schema })

type Schema = typeof schema
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

// Lo que aceptan las funciones de servicio que pueden correr tanto sueltas
// como dentro de una transacción: `db` o el `tx` de withTx.
export type Executor = PgDatabase<PgQueryResultHKT, Schema>

// Transacción interactiva (BEGIN … COMMIT, con ROLLBACK si `fn` lanza).
// El driver HTTP no soporta transacciones interactivas, así que se abre un
// Pool por WebSocket solo para esta operación y se cierra al terminar.
// Node 22+ trae WebSocket global, que es lo que usa el driver.
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString })
  try {
    return await drizzleWs({ client: pool, schema }).transaction(fn)
  } finally {
    await pool.end()
  }
}
