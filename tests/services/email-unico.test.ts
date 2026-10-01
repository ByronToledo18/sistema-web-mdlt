import { beforeEach, describe, expect, test } from "vitest"
import { sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { clientes, roles, usuarios } from "@/server/db/schema"
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "@/server/services/_shared"
import { emailIgual } from "@/server/services/auth"
import { crearClienteBody } from "@/server/validators/clientes"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

// Índices únicos sobre lower(email) (migración 0003) y búsquedas por la
// misma expresión (emailIgual).

beforeEach(resetDb)

async function codigoDeError(promesa: Promise<unknown>) {
  try {
    await promesa
    return null
  } catch (error) {
    return pgErrorCode(error)
  }
}

async function rol() {
  const [r] = await db.insert(roles).values({ nombre: "asistente" }).returning()
  return r.id
}

describe("unicidad de email sin distinguir mayúsculas", () => {
  test("usuarios: no admite el mismo email con otra capitalización", async () => {
    const rol_id = await rol()
    await db.insert(usuarios).values({ nombre: "A", email: "ana@test.local", hash_password: "x", rol_id })
    const error = await codigoDeError(
      db.insert(usuarios).values({ nombre: "B", email: "ANA@Test.Local", hash_password: "x", rol_id }),
    )
    expect(error).toBe(PG_UNIQUE_VIOLATION)
  })

  test("clientes: índice parcial, admite varios sin email pero no emails repetidos", async () => {
    await crearCliente({ email: null })
    await crearCliente({ email: null })
    await crearCliente({ email: "cli@test.local" })
    expect(await codigoDeError(crearCliente({ email: "CLI@test.local" }))).toBe(PG_UNIQUE_VIOLATION)
    expect(await db.select().from(clientes)).toHaveLength(3)
  })

  test("los índices existen sobre lower(email)", async () => {
    const { rows } = await db.execute<{ indexname: string; indexdef: string }>(
      sql`SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('usuarios_email_lower_key', 'clientes_email_lower_key') ORDER BY indexname`,
    )
    expect(rows.map((r) => r.indexname)).toEqual(["clientes_email_lower_key", "usuarios_email_lower_key"])
    for (const r of rows) {
      expect(r.indexdef).toMatch(/UNIQUE INDEX/)
      expect(r.indexdef).toMatch(/lower\(\(email\)::text\)/)
    }
    expect(rows[0].indexdef).toMatch(/WHERE \(email IS NOT NULL\)/)
  })
})

describe("emailIgual", () => {
  test("encuentra la cuenta con cualquier capitalización del email buscado", async () => {
    const c = await crearCliente({ email: "maria@test.local" })
    const filas = await db.select({ id: clientes.id }).from(clientes).where(emailIgual(clientes.email, " MARIA@Test.local "))
    expect(filas).toEqual([{ id: c.id }])
  })

  test("usa el índice de lower(email)", async () => {
    const rol_id = await rol()
    await db.insert(usuarios).values({ nombre: "A", email: "ana@test.local", hash_password: "x", rol_id })
    await db.execute(sql`SET enable_seqscan = off`)
    try {
      const consulta = db.select({ id: usuarios.id }).from(usuarios).where(emailIgual(usuarios.email, "ana@test.local"))
      const { sql: texto, params } = consulta.toSQL()
      // EXPLAIN con el mismo SQL que genera drizzle (parámetro sustituido).
      const literal = texto.replace("$1", `'${String(params[0])}'`)
      const { rows } = await db.execute<{ "QUERY PLAN": string }>(sql.raw(`EXPLAIN ${literal}`))
      expect(rows.map((r) => r["QUERY PLAN"]).join("\n")).toContain("usuarios_email_lower_key")
    } finally {
      await db.execute(sql`SET enable_seqscan = on`)
    }
  })
})

describe("clientes del admin", () => {
  test("el email se guarda normalizado", () => {
    expect(crearClienteBody.parse({ nombre: "Ana", cedula: "0911111111", email: "  Ana@Test.Local " }).email).toBe("ana@test.local")
    expect(crearClienteBody.parse({ nombre: "Ana", cedula: "0911111111", email: "" }).email).toBeNull()
  })
})
