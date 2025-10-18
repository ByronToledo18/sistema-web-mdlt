import { type NextRequest, NextResponse } from "next/server"
import { sql, executeQuery } from "@/lib/db"
import { requireAuth, hashPassword } from "@/lib/auth"

// GET - Listar todos los clientes
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Starting GET clientes")
    await requireAuth()
    console.log("[v0] Auth passed")

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const mostrarInactivos = searchParams.get("mostrarInactivos") === "true"

    let queryText = `SELECT * FROM clientes WHERE 1=1`
    const params: any[] = []

    if (!mostrarInactivos) {
      queryText += ` AND activo = true`
    }

    if (search) {
      queryText += ` AND (nombre ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1} OR telefono ILIKE $${params.length + 1} OR cedula ILIKE $${params.length + 1})`
      params.push(`%${search}%`)
    }

    queryText += ` ORDER BY created_at DESC`

    console.log("[v0] About to execute query")
    const clientes = await executeQuery(queryText, params)
    console.log("[v0] Query executed, result length:", clientes?.length)

    console.log("[v0] Returning response")
    return NextResponse.json({ clientes })
  } catch (error: any) {
    console.error("[v0] Get clientes error:", error)
    console.error("[v0] Error type:", typeof error)
    console.error("[v0] Error message:", error?.message)
    console.error("[v0] Error stack:", error?.stack)
    return NextResponse.json({ error: error?.message || "Error al obtener clientes" }, { status: 500 })
  }
}

// POST - Crear nuevo cliente
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador", "asistente"])

    const { nombre, cedula, telefono, email, direccion, notas } = await request.json()

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    if (!cedula) {
      return NextResponse.json({ error: "La cédula es requerida" }, { status: 400 })
    }

    if (cedula) {
      const existingCliente = await sql`
        SELECT id FROM clientes WHERE cedula = ${cedula}
      `

      if (existingCliente.length > 0) {
        return NextResponse.json({ error: "La cédula ya está registrada en el sistema" }, { status: 400 })
      }
    }

    const tempPassword = generateTempPassword()
    const hashedPassword = await hashPassword(tempPassword)

    const result = await sql`
      INSERT INTO clientes (nombre, cedula, telefono, email, direccion, notas, hash_password, debe_cambiar_password)
      VALUES (${nombre}, ${cedula}, ${telefono || null}, ${email || null}, ${direccion || null}, ${notas || null}, ${hashedPassword}, true)
      RETURNING *
    `

    return NextResponse.json(
      {
        cliente: result[0],
        tempPassword: tempPassword,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("[v0] Create cliente error:", error)
    return NextResponse.json({ error: error.message || "Error al crear cliente" }, { status: 500 })
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude similar looking characters
  const length = 8
  let password = ""

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return password
}
