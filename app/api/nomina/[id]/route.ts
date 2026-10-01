import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { eliminarMovimiento, obtenerMovimiento } from "@/server/services/nomina"
import { idParams, parseParams } from "@/server/validators/common"

type Params = { id: string }

// GET - Obtener un movimiento de nómina
export const GET = withAuth<Params>(
  { permission: { module: "nomina", action: "read" }, error: "Error al obtener movimiento" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ movimiento: await obtenerMovimiento(id) })
  },
)

// DELETE - Eliminar un movimiento de nómina (correcciones)
export const DELETE = withAuth<Params>(
  { permission: { module: "nomina", action: "delete" }, error: "Error al eliminar movimiento" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const movimiento = await eliminarMovimiento(id)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "eliminar",
      modulo: "nomina",
      descripcion: `Eliminó movimiento de nómina #${id} (${movimiento.tipo}, $${movimiento.monto}) - ${movimiento.concepto}`,
    })

    return NextResponse.json({ success: true })
  },
)
