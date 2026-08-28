import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener servicio
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params

    const result = await sql`SELECT * FROM servicios WHERE id = ${id}`

    if (result.length === 0) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ servicio: result[0] })
  } catch (error: any) {
    console.error("[v0] Get servicio error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener servicio" }, { status: 500 })
  }
}

// PUT - Actualizar servicio
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])
    const { id } = await params
    const { nombre, unidad, precio_base, variable, activo, imagen_url } = await request.json()

    if (!nombre || precio_base === undefined) {
      return NextResponse.json({ error: "Nombre y precio base son requeridos" }, { status: 400 })
    }

    if (precio_base < 0) {
      return NextResponse.json({ error: "El precio no puede ser negativo" }, { status: 400 })
    }

    const result = await sql`
      UPDATE servicios
      SET nombre = ${nombre}, unidad = ${unidad || null}, precio_base = ${precio_base}, 
          variable = ${variable === true}, activo = ${activo !== false}, 
          imagen_url = ${imagen_url || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ servicio: result[0] })
  } catch (error: any) {
    console.error("[v0] Update servicio error:", error)
    return NextResponse.json({ error: error.message || "Error al actualizar servicio" }, { status: 500 })
  }
}

// DELETE - Eliminar servicio
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])
    const { id } = await params

    const usageCheck = await sql`
      SELECT COUNT(*) as count 
      FROM pedido_items 
      WHERE item_tipo = 'servicio' AND item_id = ${id}
    `

    const usageCount = Number.parseInt(usageCheck[0].count)

    if (usageCount > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar este servicio porque ya ha sido usado en pedidos. Solo puedes inhabilitarlo.",
          canDelete: false,
        },
        { status: 400 },
      )
    }

    const result = await sql`DELETE FROM servicios WHERE id = ${id} RETURNING *`

    if (result.length === 0) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete servicio error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar servicio" }, { status: 500 })
  }
}
