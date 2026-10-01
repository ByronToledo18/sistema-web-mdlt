import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { agregarItem } from "@/server/services/pedidos"
import { idParams, parseBody, parseParams } from "@/server/validators/common"
import { agregarItemBody } from "@/server/validators/pedidos"

// POST - Agregar item al pedido
export const POST = withAuth<{ id: string }>(
  { permission: { module: "pedidos", action: "update" }, error: "Error al agregar item" },
  async (request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const input = await parseBody(request, agregarItemBody)
    return NextResponse.json({ item: await agregarItem(user, id, input) }, { status: 201 })
  },
)
