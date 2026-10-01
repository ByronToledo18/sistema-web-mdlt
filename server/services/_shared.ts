import "server-only"

import { sql, type SQL } from "drizzle-orm"
import type { Executor } from "@/server/db/client"

// --- Dinero -----------------------------------------------------------------
// Las columnas numeric(10,2) llegan como string. Las comparaciones de saldo se
// hacen en centavos enteros para no depender de errores de punto flotante
// (0.1 + 0.2 > 0.3).

export function toCents(value: string | number | null | undefined): number {
  return Math.round(Number(value ?? 0) * 100)
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function money(value: number): string {
  return fromCents(toCents(value))
}

// --- Errores de Postgres -------------------------------------------------------
// Drizzle envuelve los errores del driver en DrizzleQueryError (con `cause`).

export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error
  for (let i = 0; i < 3 && current; i++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === "string") return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

export const PG_UNIQUE_VIOLATION = "23505"
export const PG_FOREIGN_KEY_VIOLATION = "23503"

// --- SQL crudo ----------------------------------------------------------------

export async function queryRows<T>(ex: Executor, query: SQL): Promise<T[]> {
  const result = (await ex.execute(query)) as unknown as { rows: T[] }
  return result.rows
}

// --- Secuencias por año --------------------------------------------------------
// Numeración correlativa atómica (nextval) para códigos como TUTU-2026-0001.
// La secuencia se crea la primera vez que se usa en el año, arrancando después
// del mayor número que ya exista con ese prefijo.

interface SecuenciaOptions {
  prefix: string
  seqName: string
  padding: number
  // Columna que guarda códigos con ese prefijo, para sembrar la secuencia.
  seed?: { table: string; column: string }
}

export async function siguienteCodigo(ex: Executor, opts: SecuenciaOptions): Promise<string> {
  const [exists] = await queryRows<{ reg: string | null }>(ex, sql`SELECT to_regclass(${opts.seqName}) AS reg`)

  if (!exists?.reg) {
    let startAt = 1
    if (opts.seed) {
      const [max] = await queryRows<{ max_numero: string | null }>(
        ex,
        sql`SELECT MAX(CAST(SUBSTRING(${sql.identifier(opts.seed.column)} FROM ${opts.prefix.length + 1}) AS INTEGER)) AS max_numero
            FROM ${sql.identifier(opts.seed.table)}
            WHERE ${sql.identifier(opts.seed.column)} LIKE ${`${opts.prefix}%`}`,
      )
      startAt = (max?.max_numero ? Number.parseInt(max.max_numero) : 0) + 1
    }
    await ex.execute(
      sql`CREATE SEQUENCE IF NOT EXISTS ${sql.identifier(opts.seqName)} START ${sql.raw(String(startAt))}`,
    )
  }

  const [next] = await queryRows<{ siguiente: string }>(ex, sql`SELECT nextval(${opts.seqName}::regclass) AS siguiente`)
  return `${opts.prefix}${Number(next.siguiente).toString().padStart(opts.padding, "0")}`
}

// --- Fechas ---------------------------------------------------------------------

export function periodoActual(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}
