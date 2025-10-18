import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador"])
    const { id } = await params

    // Verificar que el cliente existe
    const [cliente] = await sql`
      SELECT activo FROM clientes WHERE id = ${id}
    `

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    // Alternar el estado activo
    const result = await sql`
      UPDATE clientes
      SET activo = NOT activo,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING activo
    `

    const nuevoEstado = result[0].activo

    // Registrar en auditoría
    await createAuditLog({
      usuario_id: user.id,
      accion: nuevoEstado ? "ACTIVAR_CLIENTE" : "DESACTIVAR_CLIENTE",
      modulo: "clientes",
      descripcion: `Cliente ID ${id} ${nuevoEstado ? "activado" : "desactivado"}`,
    })

    return NextResponse.json({
      success: true,
      activo: nuevoEstado,
    })
  } catch (error) {
    console.error("[v0] Error toggling cliente status:", error)
    return NextResponse.json({ error: "Error al cambiar estado del cliente" }, { status: 500 })
  }
}
