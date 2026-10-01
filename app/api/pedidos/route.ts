import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { crearPedido, listarPedidos } from "@/server/services/pedidos"
import { parseBody, parseQuery } from "@/server/validators/common"
import { crearPedidoBody, listarPedidosQuery } from "@/server/validators/pedidos"

// GET - Listar pedidos con filtros
export const GET = withAuth(
  { permission: { module: "pedidos", action: "read" }, error: "Error al obtener pedidos" },
  async (request) => {
    const filtros = parseQuery(request, listarPedidosQuery)
    return NextResponse.json({ pedidos: await listarPedidos(filtros) })
  },
)

// POST - Crear nuevo pedido
export const POST = withAuth(
  { permission: { module: "pedidos", action: "create" }, error: "Error al crear pedido" },
  async (request) => {
    const { cliente_id } = await parseBody(request, crearPedidoBody)
    return NextResponse.json({ pedido: await crearPedido(cliente_id) }, { status: 201 })
  },
)
