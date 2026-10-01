import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { actualizarEstadoPedido, eliminarPedido, obtenerPedido } from "@/server/services/pedidos"
import { idParams, parseBody, parseParams } from "@/server/validators/common"
import { actualizarEstadoBody } from "@/server/validators/pedidos"

type Params = { id: string }

// GET - Obtener pedido con detalles
export const GET = withAuth<Params>(
  { permission: { module: "pedidos", action: "read" }, error: "Error al obtener pedido" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ pedido: await obtenerPedido(id) })
  },
)

// PUT - Actualizar estado del pedido
export const PUT = withAuth<Params>(
  { permission: { module: "pedidos", action: "update" }, error: "Error al actualizar pedido" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const { estado } = await parseBody(request, actualizarEstadoBody)
    return NextResponse.json({ pedido: await actualizarEstadoPedido(id, estado) })
  },
)

// DELETE - Eliminar pedido
export const DELETE = withAuth<Params>(
  { permission: { module: "pedidos", action: "delete" }, error: "Error al eliminar pedido" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    await eliminarPedido(id)
    return NextResponse.json({ success: true })
  },
)
