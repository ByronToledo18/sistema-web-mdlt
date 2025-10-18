import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { nombre, email, telefono, direccion, password } = await request.json()

    // Validaciones
    if (!nombre || !email || !password) {
      return NextResponse.json({ error: "Nombre, email y contraseña son requeridos" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Verificar si el email ya existe
    const existingCliente = await sql`SELECT id FROM clientes WHERE email = ${email}`

    if (existingCliente.length > 0) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 400 })
    }

    // Hash de la contraseña
    const hashedPassword = await hashPassword(password)

    // Crear cliente
    const result = await sql`
      INSERT INTO clientes (nombre, email, telefono, direccion, hash_password, activo)
      VALUES (${nombre}, ${email}, ${telefono || null}, ${direccion || null}, ${hashedPassword}, true)
      RETURNING id, nombre, email
    `

    return NextResponse.json({ cliente: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Registration error:", error)
    return NextResponse.json({ error: error.message || "Error al registrarse" }, { status: 500 })
  }
}
