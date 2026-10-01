import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { editarItem, eliminarItem } from "@/server/services/pedidos"
import { parseBody, parseParams } from "@/server/validators/common"
import { editarItemBody, pedidoItemParams } from "@/server/validators/pedidos"

type Params = { id: string; itemId: string }

// PUT - Actualizar item
export const PUT = withAuth<Params>(
  { permission: { module: "pedidos", action: "update" }, error: "Error al actualizar item" },
  async (request, { params }, user) => {
    const { id, itemId } = await parseParams(params, pedidoItemParams)
    const input = await parseBody(request, editarItemBody)
    return NextResponse.json({ item: await editarItem(user, id, itemId, input) })
  },
)

// DELETE - Eliminar item
export const DELETE = withAuth<Params>(
  { permission: { module: "pedidos", action: "update" }, error: "Error al eliminar item" },
  async (_request, { params }, user) => {
    const { id, itemId } = await parseParams(params, pedidoItemParams)
    await eliminarItem(user, id, itemId)
    return NextResponse.json({ success: true })
  },
)
