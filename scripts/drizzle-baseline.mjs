// Marca drizzle/0000_baseline.sql como ya aplicada, sin ejecutarla.
//
// La base de producción ya tiene todas esas tablas (se crearon con los
// scripts/0xx-*.sql). Este script crea la tabla de control de Drizzle
// (drizzle.__drizzle_migrations) y registra el baseline con el mismo hash y
// timestamp que calcula `drizzle-kit migrate`, para que a partir de ahí solo
// se apliquen las migraciones nuevas (0001_…, 0002_…).
//
// Uso (una sola vez por base de datos): pnpm db:baseline
// Es idempotente: si el baseline ya está registrado, no hace nada.

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error("Falta DATABASE_URL (¿existe .env.local?)")
  process.exit(1)
}

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"))
const baseline = journal.entries.find((e) => e.idx === 0)
if (!baseline) {
  console.error("No se encontró la migración 0000 en drizzle/meta/_journal.json")
  process.exit(1)
}

const query = readFileSync(`drizzle/${baseline.tag}.sql`, "utf8")
const hash = createHash("sha256").update(query).digest("hex")

const sql = neon(url)

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`

const existing = await sql`SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`
if (existing.length > 0) {
  console.log(`El baseline ${baseline.tag} ya estaba registrado.`)
} else {
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${baseline.when})`
  console.log(`Baseline ${baseline.tag} registrado como aplicado.`)
}
