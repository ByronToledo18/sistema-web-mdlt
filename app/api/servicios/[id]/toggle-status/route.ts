import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"

// POST - Alternar estado activo/inactivo del servicio
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(["administrador"])
    const { id } = params

    // Toggle the activo status
    const result = await sql`
      UPDATE servicios
      SET activo = NOT activo, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    }

    const servicio = result[0]

    // Create audit log
    await createAuditLog(
      user.id,
      "servicios",
      Number.parseInt(id),
      "update",
      `Estado cambiado a ${servicio.activo ? "activo" : "inactivo"}`,
    )

    return NextResponse.json({
      success: true,
      activo: servicio.activo,
      message: `Servicio ${servicio.activo ? "activado" : "desactivado"} exitosamente`,
    })
  } catch (error: any) {
    console.error("[v0] Toggle servicio status error:", error)
    return NextResponse.json({ error: error.message || "Error al cambiar estado del servicio" }, { status: 500 })
  }
}
