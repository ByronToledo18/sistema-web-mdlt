import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { actualizarEnvio, eliminarEnvio, obtenerEnvio } from "@/server/services/envios"
import { idParams, parseBody, parseParams } from "@/server/validators/common"
import { actualizarEnvioBody } from "@/server/validators/pagos"

type Params = { id: string }

// GET - Obtener envío
export const GET = withAuth<Params>(
  { permission: { module: "envios", action: "read" }, error: "Error al obtener envío" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ envio: await obtenerEnvio(id) })
  },
)

// PUT - Actualizar estado, costo o guía del envío
export const PUT = withAuth<Params>(
  { permission: { module: "envios", action: "update" }, error: "Error al actualizar envío" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const input = await parseBody(request, actualizarEnvioBody)
    return NextResponse.json({ envio: await actualizarEnvio(id, input) })
  },
)

// DELETE - Eliminar envío
export const DELETE = withAuth<Params>(
  { permission: { module: "envios", action: "delete" }, error: "Error al eliminar envío" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    await eliminarEnvio(id)
    return NextResponse.json({ success: true })
  },
)
