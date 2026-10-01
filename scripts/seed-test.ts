// Datos y credenciales para los e2e de Playwright, en la base de PRUEBAS
// (mdlt-preview, la de Preview/Development en Vercel), nunca en producción.
//
// Uso: pnpm db:seed-test
//   Toma TEST_DATABASE_URL (.env.test.local) o, si no existe, DATABASE_URL
//   (.env.local). Solo escribe si esa base tiene el marcador de entorno de
//   pruebas: la tabla `_entorno` con una única fila, 'preview'. Producción no
//   tiene esa tabla y no debe tenerla, así que contra ella el seed aborta.
//
// Cada ejecución genera contraseñas nuevas al azar (nada escrito a mano) y
// las deja en .env.e2e.local, que lee playwright.config.ts. En GitHub Actions
// las exporta además a $GITHUB_ENV enmascaradas. Es idempotente: actualiza
// las filas E2E si ya existen.

import { randomBytes } from "node:crypto"
import { appendFileSync, writeFileSync } from "node:fs"
import { neon } from "@neondatabase/serverless"
import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"
import { hashPassword } from "@/lib/password"
import * as schema from "@/server/db/schema"

const { clientes, productos, roles, servicios, tarifasEnvio, usuarios } = schema

function abortar(mensaje: string): never {
  console.error(`seed-test abortado: ${mensaje}`)
  process.exit(1)
}

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
if (!url) abortar("falta TEST_DATABASE_URL o DATABASE_URL (la base de pruebas mdlt-preview).")

function hostYBase(connectionString: string): string {
  const u = new URL(connectionString)
  // El pooler de Neon es el mismo endpoint con el sufijo -pooler.
  return `${u.hostname.replace("-pooler.", ".")}/${u.pathname.replace(/^\//, "")}`
}

// Chequeo extra (opcional): si se conoce la URL de producción, no puede ser la misma base.
if (process.env.PROD_DATABASE_URL && hostYBase(process.env.PROD_DATABASE_URL) === hostYBase(url)) {
  abortar("la base indicada es la de producción (coincide con PROD_DATABASE_URL).")
}

const db = drizzle({ client: neon(url), schema })

// Chequeo obligatorio: marcador de entorno de pruebas.
async function exigirMarcadorPreview() {
  let filas: { nombre: string }[]
  try {
    filas = (await db.execute(sql`SELECT nombre FROM _entorno`)).rows as { nombre: string }[]
  } catch {
    abortar(`la base ${hostYBase(url!)} no tiene la tabla _entorno: no es la base de pruebas.`)
  }
  if (filas.length !== 1 || filas[0].nombre !== "preview") {
    abortar(`_entorno de ${hostYBase(url!)} no es exactamente ['preview'] (${JSON.stringify(filas.map((f) => f.nombre))}).`)
  }
}

const password = () => randomBytes(12).toString("base64url")

const E2E = {
  admin: { email: "e2e-admin@test.local", nombre: "Admin E2E", rol: "administrador" },
  soporte: { email: "e2e-soporte@test.local", nombre: "Soporte E2E", rol: "soporte" },
  cliente: { email: "e2e-cliente@test.local", nombre: "Cliente E2E", cedula: "0000000001", telefono: "0990000001" },
  // Precio sin IVA; graba IVA (el e2e del admin cobra 2 × 25,00 + 15 % = 57,50).
  producto: { sku: "E2E-TUTU", nombre: "Tutu E2E", precio: "25.00", stock: 100_000, graba_iva: true },
  ciudad: { ciudad: "Ciudad E2E", costo: "4.00" },
}

async function rolId(nombre: string): Promise<number> {
  await db.insert(roles).values({ nombre }).onConflictDoNothing()
  const [rol] = await db.select({ id: roles.id }).from(roles).where(eq(roles.nombre, nombre))
  return rol.id
}

async function usuario(datos: { email: string; nombre: string; rol: string }, pass: string) {
  const values = {
    email: datos.email,
    nombre: datos.nombre,
    rol_id: await rolId(datos.rol),
    hash_password: await hashPassword(pass),
    activo: true,
    // Los usuarios del e2e entran directo al panel (sin /cambiar-password).
    debe_cambiar_password: false,
  }
  await db
    .insert(usuarios)
    .values(values)
    .onConflictDoUpdate({ target: usuarios.email, set: { ...values, updated_at: sql`CURRENT_TIMESTAMP` } })
}

async function main() {
  await exigirMarcadorPreview()

  const creds = {
    E2E_ADMIN_EMAIL: E2E.admin.email,
    E2E_ADMIN_PASSWORD: password(),
    E2E_SOPORTE_EMAIL: E2E.soporte.email,
    E2E_SOPORTE_PASSWORD: password(),
    E2E_CLIENTE_EMAIL: E2E.cliente.email,
    E2E_CLIENTE_PASSWORD: password(),
    E2E_CLIENTE_NOMBRE: E2E.cliente.nombre,
    E2E_PRODUCTO_NOMBRE: E2E.producto.nombre,
  }

  await usuario(E2E.admin, creds.E2E_ADMIN_PASSWORD)
  await usuario(E2E.soporte, creds.E2E_SOPORTE_PASSWORD)

  const cliente = {
    ...E2E.cliente,
    hash_password: await hashPassword(creds.E2E_CLIENTE_PASSWORD),
    activo: true,
    debe_cambiar_password: false,
    requiere_cambio_password: false,
  }
  await db
    .insert(clientes)
    .values(cliente)
    .onConflictDoUpdate({ target: clientes.cedula, set: { ...cliente, updated_at: sql`CURRENT_TIMESTAMP` } })

  // Stock alto: cada corrida del e2e de checkout consume unidades.
  await db
    .insert(productos)
    .values({ ...E2E.producto, activo: true })
    .onConflictDoUpdate({ target: productos.sku, set: { ...E2E.producto, activo: true } })

  const [envio] = await db.select({ id: servicios.id }).from(servicios).where(eq(servicios.nombre, "Envío"))
  if (!envio) {
    await db.insert(servicios).values({ nombre: "Envío", precio_base: "0.00", variable: true, activo: true })
  }
  await db
    .insert(tarifasEnvio)
    .values({ ...E2E.ciudad, activo: true })
    .onConflictDoUpdate({ target: tarifasEnvio.ciudad, set: { costo: E2E.ciudad.costo, activo: true } })

  const lines = Object.entries(creds).map(([k, v]) => `${k}=${v}`)
  writeFileSync(".env.e2e.local", `# Generado por scripts/seed-test.ts — no editar ni commitear\n${lines.join("\n")}\n`)

  if (process.env.GITHUB_ENV) {
    for (const [k, v] of Object.entries(creds)) {
      if (k.endsWith("_PASSWORD")) console.log(`::add-mask::${v}`)
    }
    appendFileSync(process.env.GITHUB_ENV, `${lines.join("\n")}\n`)
  }

  console.log("Seed de test listo. Credenciales en .env.e2e.local")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
