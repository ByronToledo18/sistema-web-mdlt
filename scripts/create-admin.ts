// Crea (o resetea) los usuarios internos iniciales con contraseñas aleatorias.
//
// Uso: pnpm db:create-admin            (usa DATABASE_URL de .env.local)
//      node --env-file=<archivo> --import tsx scripts/create-admin.ts
//
// Requiere que la base ya tenga las migraciones aplicadas (roles en
// drizzle/0001_datos_referencia.sql). Las contraseñas se generan en el momento y
// se muestran UNA sola vez: guárdalas y cámbialas después del primer login.
// Resetear incrementa token_version, así que cierra las sesiones abiertas.

import { randomBytes } from "node:crypto"
import { neon } from "@neondatabase/serverless"
import { hashPassword } from "@/lib/password"

const USERS_TO_SETUP = [
  { email: "admin@elmundodelastutus.com", nombre: "Administrador", rolNombre: "administrador" },
  { email: "soporte@elmundodelastutus.com", nombre: "Soporte Técnico", rolNombre: "soporte" },
]

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error("Falta DATABASE_URL (¿existe el archivo de entorno?)")
  process.exit(1)
}
const sql = neon(url)

async function setupUser(email: string, nombre: string, rolNombre: string) {
  const password = randomBytes(12).toString("base64url")
  const hash = await hashPassword(password)

  const rol = await sql`SELECT id FROM roles WHERE nombre = ${rolNombre}`
  if (rol.length === 0) {
    throw new Error(`Rol '${rolNombre}' no encontrado: aplica primero las migraciones (pnpm db:migrate).`)
  }

  const existing = await sql`SELECT id FROM usuarios WHERE email = ${email}`
  if (existing.length > 0) {
    console.log(`Usuario ${email} ya existe, reseteando contraseña...`)
    await sql`
      UPDATE usuarios
      SET hash_password = ${hash}, rol_id = ${rol[0].id}, nombre = ${nombre}, activo = true,
          token_version = token_version + 1
      WHERE email = ${email}
    `
  } else {
    console.log(`Creando usuario ${email}...`)
    await sql`
      INSERT INTO usuarios (rol_id, nombre, email, hash_password, activo)
      VALUES (${rol[0].id}, ${nombre}, ${email}, ${hash}, true)
    `
  }
  return { email, password, rol: rolNombre }
}

async function main() {
  const results = []
  for (const u of USERS_TO_SETUP) {
    results.push(await setupUser(u.email, u.nombre, u.rolNombre))
  }

  console.log("\nUsuarios configurados. Credenciales (guárdalas ahora, no se volverán a mostrar):\n")
  for (const r of results) {
    console.log(`  [${r.rol}] ${r.email} — ${r.password}`)
  }
  console.log("\nCambia estas contraseñas después del primer login.")
}

main().catch((error) => {
  console.error("Error al configurar usuarios:", error)
  process.exit(1)
})
