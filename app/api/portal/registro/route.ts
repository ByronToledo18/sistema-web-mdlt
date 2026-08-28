import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { nombre, cedula, email, telefono, direccion, password } = await request.json()

    // Validaciones
    if (!nombre || !cedula || !email || !password) {
      return NextResponse.json({ error: "Nombre, cédula, email y contraseña son requeridos" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Verificar si el email ya existe
    const existingEmail = await sql`SELECT id FROM clientes WHERE email = ${email}`
    if (existingEmail.length > 0) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    // La cédula es el identificador canónico del cliente en todo el sistema
    // (es lo que usa el checkout del catálogo público, que no requiere login).
    // Si ya existe una fila de `clientes` con esa cédula - creada por un
    // pedido anónimo previo - la vinculamos en vez de crear un cliente
    // duplicado.
    const existingCedula = await sql`SELECT id, hash_password FROM clientes WHERE cedula = ${cedula}`

    let cliente
    if (existingCedula.length > 0) {
      if (existingCedula[0].hash_password) {
        return NextResponse.json({ error: "Esta cédula ya tiene una cuenta registrada" }, { status: 400 })
      }
      const result = await sql`
        UPDATE clientes
        SET nombre = ${nombre}, email = ${email}, telefono = ${telefono || null},
            direccion = ${direccion || null}, hash_password = ${hashedPassword},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existingCedula[0].id}
        RETURNING id, nombre, email
      `
      cliente = result[0]
    } else {
      const result = await sql`
        INSERT INTO clientes (nombre, cedula, email, telefono, direccion, hash_password, activo)
        VALUES (${nombre}, ${cedula}, ${email}, ${telefono || null}, ${direccion || null}, ${hashedPassword}, true)
        RETURNING id, nombre, email
      `
      cliente = result[0]
    }

    return NextResponse.json({ cliente }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Registration error:", error)
    return NextResponse.json({ error: error.message || "Error al registrarse" }, { status: 500 })
  }
}
