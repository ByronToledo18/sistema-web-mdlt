import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener un cliente por ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
    const { id } = params

    const result = await sql`SELECT * FROM clientes WHERE id = ${id}`

    if (result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ cliente: result[0] })
  } catch (error: any) {
    console.error("[v0] Get cliente error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener cliente" }, { status: 500 })
  }
}

// PUT - Actualizar cliente
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador", "asistente"])
    const { id } = params
    const body = await request.json()

    console.log("[v0] PUT clientes body:", JSON.stringify(body))

    const { nombre, cedula, telefono, email, direccion, notas } = body

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    if (cedula) {
      const existingCliente = await sql`
        SELECT id FROM clientes WHERE cedula = ${cedula} AND id != ${id}
      `

      if (existingCliente.length > 0) {
        return NextResponse.json({ error: "La cédula ya está registrada en el sistema" }, { status: 400 })
      }
    }

    console.log("[v0] About to UPDATE cliente with:", { nombre, cedula, telefono, email, direccion, notas })

    const result = await sql`
      UPDATE clientes
      SET nombre = ${nombre}, cedula = ${cedula || null}, telefono = ${telefono || null}, email = ${email || null}, 
          direccion = ${direccion || null}, notas = ${notas || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    console.log("[v0] Cliente updated successfully:", result[0])

    if (result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ cliente: result[0] })
  } catch (error: any) {
    console.error("[v0] Update cliente error:", error)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error stack:", error.stack)
    return NextResponse.json({ error: error.message || "Error al actualizar cliente" }, { status: 500 })
  }
}

// POST - Habilitar/Deshabilitar cliente
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador"])
    const { id } = params
    const body = await request.json()

    const { estado } = body

    if (estado === undefined) {
      return NextResponse.json({ error: "El estado es requerido" }, { status: 400 })
    }

    const result = await sql`
      UPDATE clientes
      SET estado = ${estado}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ cliente: result[0] })
  } catch (error: any) {
    console.error("[v0] Toggle cliente estado error:", error)
    return NextResponse.json({ error: error.message || "Error al cambiar el estado del cliente" }, { status: 500 })
  }
}
