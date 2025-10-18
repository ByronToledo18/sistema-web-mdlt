import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

const sql = neon(process.env.DATABASE_URL!)

async function setupAdmin() {
  console.log("[v0] Setting up admin user...")

  const email = "admin@elmundodelastutus.com"
  const password = "Admin123!"
  const nombre = "Administrador"

  // Generate bcrypt hash
  const hashedPassword = await bcrypt.hash(password, 10)
  console.log("[v0] Generated password hash")

  // Check if admin role exists
  const roles = await sql`SELECT id FROM roles WHERE nombre = 'administrador'`
  let rolId = roles[0]?.id

  if (!rolId) {
    console.log("[v0] Creating administrador role...")
    const newRole = await sql`
      INSERT INTO roles (nombre) 
      VALUES ('administrador') 
      RETURNING id
    `
    rolId = newRole[0].id
  }

  // Check if user exists
  const existingUser = await sql`
    SELECT id FROM usuarios WHERE email = ${email}
  `

  if (existingUser.length > 0) {
    // Update existing user
    console.log("[v0] Updating existing admin user...")
    await sql`
      UPDATE usuarios 
      SET hash_password = ${hashedPassword},
          nombre = ${nombre},
          rol_id = ${rolId},
          activo = true
      WHERE email = ${email}
    `
    console.log("[v0] Admin user updated successfully!")
  } else {
    // Create new user
    console.log("[v0] Creating new admin user...")
    await sql`
      INSERT INTO usuarios (email, hash_password, nombre, rol_id, activo)
      VALUES (${email}, ${hashedPassword}, ${nombre}, ${rolId}, true)
    `
    console.log("[v0] Admin user created successfully!")
  }

  console.log("\n✅ Admin credentials:")
  console.log("   Email:", email)
  console.log("   Password:", password)
  console.log("\nYou can now login at /login")
}

setupAdmin().catch(console.error)
