// Script para crear usuario administrador
// Ejecutar con: node --loader ts-node/esm scripts/create-admin.ts

import { sql } from "../lib/db"
import { hashPassword } from "../lib/auth"

async function createAdmin() {
  try {
    console.log("Creando usuario administrador...")

    const email = "admin@elmundodelastutus.com"
    const password = "Admin123!"
    const nombre = "Administrador"

    // Generar hash de la contraseña
    const hash = await hashPassword(password)

    console.log("Hash generado:", hash)

    // Verificar si el usuario ya existe
    const existing = await sql`
      SELECT id FROM usuarios WHERE email = ${email}
    `

    if (existing.length > 0) {
      console.log("Usuario ya existe, actualizando contraseña...")
      await sql`
        UPDATE usuarios 
        SET hash_password = ${hash}, activo = true
        WHERE email = ${email}
      `
      console.log("✓ Contraseña actualizada")
    } else {
      console.log("Creando nuevo usuario...")
      // Obtener el rol de administrador
      const roles = await sql`
        SELECT id FROM roles WHERE nombre = 'administrador'
      `

      if (roles.length === 0) {
        throw new Error("Rol de administrador no encontrado. Ejecuta primero el script 001-create-tables.sql")
      }

      await sql`
        INSERT INTO usuarios (rol_id, nombre, email, hash_password, activo)
        VALUES (${roles[0].id}, ${nombre}, ${email}, ${hash}, true)
      `
      console.log("✓ Usuario creado exitosamente")
    }

    console.log("\nCredenciales de acceso:")
    console.log("Email:", email)
    console.log("Contraseña:", password)
    console.log("\n⚠️  Cambia esta contraseña después del primer login")
  } catch (error) {
    console.error("Error al crear administrador:", error)
    process.exit(1)
  }
}

createAdmin()
