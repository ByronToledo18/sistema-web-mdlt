import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"

// POST - Alternar estado activo/inactivo del producto
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador"])
    const { id } = await params

    // Toggle the activo status
    const result = await sql`
      UPDATE productos
      SET activo = NOT activo, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const producto = result[0]

    // Create audit log
    await createAuditLog({
      usuario_id: user.id,
      accion: "update",
      modulo: "productos",
      descripcion: `Producto #${id}: estado cambiado a ${producto.activo ? "activo" : "inactivo"}`,
    })

    return NextResponse.json({
      success: true,
      activo: producto.activo,
      message: `Producto ${producto.activo ? "activado" : "desactivado"} exitosamente`,
    })
  } catch (error: any) {
    console.error("[v0] Toggle producto status error:", error)
    return NextResponse.json({ error: error.message || "Error al cambiar estado del producto" }, { status: 500 })
  }
}
