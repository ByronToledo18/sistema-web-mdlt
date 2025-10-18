import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, hashPassword } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(["soporte", "administrador"])

    const usuarios = await sql`
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol_id,
        u.activo,
        r.nombre as rol_nombre,
        u.created_at,
        u.updated_at
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      ORDER BY u.created_at DESC
    `

    return NextResponse.json(usuarios)
  } catch (error) {
    console.error("[v0] Error fetching users:", error)
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(["soporte", "administrador"])
    const { nombre, email, password, rol_id } = await request.json()

    // Validate required fields
    if (!nombre || !email || !password || !rol_id) {
      return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 })
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Check if email already exists
    const [existingUser] = await sql`
      SELECT id FROM usuarios WHERE email = ${email}
    `

    if (existingUser) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    // Create user
    const [newUser] = await sql`
      INSERT INTO usuarios (nombre, email, hash_password, rol_id, activo)
      VALUES (${nombre}, ${email}, ${hashedPassword}, ${rol_id}, true)
      RETURNING id, nombre, email
    `

    // Create audit log
    await createAuditLog({
      usuario_id: user.id,
      accion: "CREAR",
      modulo: "usuarios",
      descripcion: `Creó el usuario ${nombre} (${email})`,
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create user error:", error)
    return NextResponse.json(
      { error: error.message || "Error al crear usuario" },
      { status: error.message?.includes("No autorizado") ? 401 : 500 },
    )
  }
}
