import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { hashPassword } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function POST() {
  try {
    console.log("[v0] Setting up users...")

    const users = [
      {
        email: "admin@elmundodelastutus.com",
        password: "Admin123!",
        nombre: "Administrador",
        rolNombre: "administrador",
      },
      {
        email: "soporte@elmundodelastutus.com",
        password: "Soporte123!",
        nombre: "Soporte Técnico",
        rolNombre: "soporte",
      },
    ]

    const results = []

    for (const user of users) {
      const hashedPassword = await hashPassword(user.password)
      console.log(`[v0] Generated password hash for ${user.email}:`, hashedPassword.substring(0, 20) + "...")

      // Check if role exists
      const roles = await sql`SELECT id FROM roles WHERE nombre = ${user.rolNombre}`
      let rolId = roles[0]?.id

      if (!rolId) {
        console.log(`[v0] Creating ${user.rolNombre} role...`)
        const newRole = await sql`
          INSERT INTO roles (nombre) 
          VALUES (${user.rolNombre}) 
          RETURNING id
        `
        rolId = newRole[0].id
      }

      // Check if user exists
      const existingUser = await sql`
        SELECT id FROM usuarios WHERE email = ${user.email}
      `

      if (existingUser.length > 0) {
        // Update existing user
        console.log(`[v0] Updating existing user ${user.email}...`)
        await sql`
          UPDATE usuarios 
          SET hash_password = ${hashedPassword},
              nombre = ${user.nombre},
              rol_id = ${rolId},
              activo = true
          WHERE email = ${user.email}
        `
        console.log(`[v0] User ${user.email} updated successfully!`)
      } else {
        // Create new user
        console.log(`[v0] Creating new user ${user.email}...`)
        await sql`
          INSERT INTO usuarios (email, hash_password, nombre, rol_id, activo)
          VALUES (${user.email}, ${hashedPassword}, ${user.nombre}, ${rolId}, true)
        `
        console.log(`[v0] User ${user.email} created successfully!`)
      }

      results.push({
        email: user.email,
        password: user.password,
        role: user.rolNombre,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Users configured successfully",
      credentials: results,
    })
  } catch (error) {
    console.error("[v0] Error setting up users:", error)
    return NextResponse.json({ success: false, error: "Failed to setup users" }, { status: 500 })
  }
}
