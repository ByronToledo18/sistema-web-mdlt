import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { eliminarPago, obtenerPago } from "@/server/services/pagos"
import { idParams, parseParams } from "@/server/validators/common"

type Params = { id: string }

// GET - Obtener pago
export const GET = withAuth<Params>(
  { permission: { module: "pagos", action: "read" }, error: "Error al obtener pago" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ pago: await obtenerPago(id) })
  },
)

// DELETE - Eliminar pago
export const DELETE = withAuth<Params>(
  { permission: { module: "pagos", action: "delete" }, error: "Error al eliminar pago" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    await eliminarPago(id)
    return NextResponse.json({ success: true })
  },
)
