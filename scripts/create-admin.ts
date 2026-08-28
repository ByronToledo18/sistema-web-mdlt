// Script para crear usuario administrador
// Ejecutar con: node --loader ts-node/esm scripts/create-admin.ts

import { sql } from "../lib/db"
import { hashPassword } from "../lib/auth"

const USERS_TO_SETUP = [
  { email: "admin@elmundodelastutus.com", nombre: "Administrador", rolNombre: "administrador" },
  { email: "soporte@elmundodelastutus.com", nombre: "Soporte Técnico", rolNombre: "soporte" },
]

async function setupUser(email: string, nombre: string, rolNombre: string) {
  const password = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const hash = await hashPassword(password)

  const roles = await sql`
    SELECT id FROM roles WHERE nombre = ${rolNombre}
  `

  if (roles.length === 0) {
    throw new Error(`Rol '${rolNombre}' no encontrado. Ejecuta primero el script 001-create-tables.sql`)
  }

  const rolId = roles[0].id

  const existing = await sql`
    SELECT id FROM usuarios WHERE email = ${email}
  `

  if (existing.length > 0) {
    console.log(`Usuario ${email} ya existe, actualizando contraseña...`)
    await sql`
      UPDATE usuarios
      SET hash_password = ${hash}, rol_id = ${rolId}, nombre = ${nombre}, activo = true
      WHERE email = ${email}
    `
  } else {
    console.log(`Creando nuevo usuario ${email}...`)
    await sql`
      INSERT INTO usuarios (rol_id, nombre, email, hash_password, activo)
      VALUES (${rolId}, ${nombre}, ${email}, ${hash}, true)
    `
  }

  return { email, password, rol: rolNombre }
}

async function createAdmin() {
  try {
    console.log("Configurando usuarios internos...\n")

    const results = []
    for (const user of USERS_TO_SETUP) {
      const result = await setupUser(user.email, user.nombre, user.rolNombre)
      results.push(result)
    }

    console.log("\n✓ Usuarios configurados. Credenciales de acceso (guárdalas ahora, no se volverán a mostrar):\n")
    for (const r of results) {
      console.log(`  [${r.rol}] ${r.email} — ${r.password}`)
    }
    console.log("\n⚠️  Cada usuario debe cambiar su contraseña después del primer login.")
  } catch (error) {
    console.error("Error al configurar usuarios:", error)
    process.exit(1)
  }
}

createAdmin()
