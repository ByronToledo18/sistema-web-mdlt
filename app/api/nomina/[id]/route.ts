import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getMovimiento, eliminarMovimiento } from "@/lib/nomina"
import { createAuditLog } from "@/lib/audit"

// GET - Obtener un movimiento de nómina
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])

    const movimiento = await getMovimiento(Number.parseInt((await params).id))
    if (!movimiento) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ movimiento })
  } catch (error: any) {
    console.error("[v0] Get nomina movimiento error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener movimiento" }, { status: 500 })
  }
}

// DELETE - Eliminar un movimiento de nómina (correcciones)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador"])

    const id = Number.parseInt((await params).id)
    const movimiento = await getMovimiento(id)
    if (!movimiento) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
    }

    await eliminarMovimiento(id)

    await createAuditLog({
      usuario_id: user.id,
      accion: "eliminar",
      modulo: "nomina",
      descripcion: `Eliminó movimiento de nómina #${id} (${movimiento.tipo}, $${movimiento.monto}) - ${movimiento.concepto}`,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete nomina movimiento error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar movimiento" }, { status: 500 })
  }
}
