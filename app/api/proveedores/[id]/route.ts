import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener proveedor por ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])

    const { id } = await params

    const result = await sql`SELECT * FROM proveedores WHERE id = ${id}`

    if (result.length === 0) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ proveedor: result[0] })
  } catch (error: any) {
    console.error("[v0] Get proveedor error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener proveedor" }, { status: 500 })
  }
}

// PUT - Actualizar proveedor
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])

    const { id } = await params
    const { nombre, ruc, telefono, email, direccion, contacto_nombre, contacto_telefono, notas } = await request.json()

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    if (ruc) {
      const existing = await sql`SELECT id FROM proveedores WHERE ruc = ${ruc} AND id != ${id}`
      if (existing.length > 0) {
        return NextResponse.json({ error: "El RUC ya está registrado" }, { status: 400 })
      }
    }

    const result = await sql`
      UPDATE proveedores
      SET nombre = ${nombre},
          ruc = ${ruc || null},
          telefono = ${telefono || null},
          email = ${email || null},
          direccion = ${direccion || null},
          contacto_nombre = ${contacto_nombre || null},
          contacto_telefono = ${contacto_telefono || null},
          notas = ${notas || null}
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ proveedor: result[0] })
  } catch (error: any) {
    console.error("[v0] Update proveedor error:", error)
    return NextResponse.json({ error: error.message || "Error al actualizar proveedor" }, { status: 500 })
  }
}

// DELETE - Eliminar proveedor
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])

    const { id } = await params

    // Check if proveedor has facturas
    const facturas = await sql`SELECT COUNT(*) as count FROM proveedor_facturas WHERE proveedor_id = ${id}`

    if (Number(facturas[0].count) > 0) {
      return NextResponse.json({ error: "No se puede eliminar un proveedor con facturas registradas" }, { status: 400 })
    }

    const result = await sql`DELETE FROM proveedores WHERE id = ${id} RETURNING *`

    if (result.length === 0) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ message: "Proveedor eliminado exitosamente" })
  } catch (error: any) {
    console.error("[v0] Delete proveedor error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar proveedor" }, { status: 500 })
  }
}
