import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener producto
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
    const { id } = params

    const result = await sql`SELECT * FROM productos WHERE id = ${id}`

    if (result.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ producto: result[0] })
  } catch (error: any) {
    console.error("[v0] Get producto error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener producto" }, { status: 500 })
  }
}

// PUT - Actualizar producto
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador"])
    const { id } = params
    const { sku, nombre, precio, stock, activo, imagen_url } = await request.json()

    if (!nombre || precio === undefined) {
      return NextResponse.json({ error: "Nombre y precio son requeridos" }, { status: 400 })
    }

    if (precio < 0) {
      return NextResponse.json({ error: "El precio no puede ser negativo" }, { status: 400 })
    }

    const result = await sql`
      UPDATE productos
      SET sku = ${sku || null}, nombre = ${nombre}, precio = ${precio}, stock = ${stock || 0}, 
          activo = ${activo !== false}, imagen_url = ${imagen_url || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ producto: result[0] })
  } catch (error: any) {
    console.error("[v0] Update producto error:", error)
    if (error.message?.includes("duplicate key")) {
      return NextResponse.json({ error: "El SKU ya existe" }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Error al actualizar producto" }, { status: 500 })
  }
}

// DELETE - Eliminar producto
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador"])
    const { id } = params

    const usageCheck = await sql`
      SELECT COUNT(*) as count 
      FROM pedido_items 
      WHERE item_tipo = 'producto' AND item_id = ${id}
    `

    const usageCount = Number.parseInt(usageCheck[0].count)

    if (usageCount > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar este producto porque ya ha sido usado en pedidos. Solo puedes inhabilitarlo.",
          canDelete: false,
        },
        { status: 400 },
      )
    }

    const result = await sql`DELETE FROM productos WHERE id = ${id} RETURNING *`

    if (result.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete producto error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar producto" }, { status: 500 })
  }
}
