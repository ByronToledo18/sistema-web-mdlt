import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getClienteFromToken } from "@/lib/auth"

export async function PUT(request: NextRequest) {
  try {
    const clienteToken = await getClienteFromToken()

    if (!clienteToken) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { nombre, telefono, direccion } = await request.json()

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    const result = await sql`
      UPDATE clientes
      SET nombre = ${nombre}, telefono = ${telefono || null}, direccion = ${direccion || null}
      WHERE id = ${clienteToken.id}
      RETURNING id, nombre, email, telefono, direccion
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ cliente: result[0] })
  } catch (error: any) {
    console.error("[v0] Update perfil error:", error)
    return NextResponse.json({ error: error.message || "Error al actualizar perfil" }, { status: 500 })
  }
}
