import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener pago
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador", "asistente"])
    const { id } = await params

    const result = await sql`
      SELECT p.*, ped.codigo as pedido_codigo, c.nombre as cliente_nombre
      FROM pagos p
      JOIN pedidos ped ON p.pedido_id = ped.id
      JOIN clientes c ON ped.cliente_id = c.id
      WHERE p.id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ pago: result[0] })
  } catch (error: any) {
    console.error("[v0] Get pago error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener pago" }, { status: 500 })
  }
}

// DELETE - Eliminar pago
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])
    const { id } = await params

    const result = await sql`DELETE FROM pagos WHERE id = ${id} RETURNING *`

    if (result.length === 0) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete pago error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar pago" }, { status: 500 })
  }
}
