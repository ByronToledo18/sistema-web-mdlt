import { NextResponse } from "next/server"
import { withCliente } from "@/server/auth/guard"
import { listarPedidosDeCliente } from "@/server/services/pedidos"

// GET - Pedidos del cliente autenticado
export const GET = withCliente({ error: "Error al obtener pedidos" }, async (_request, _context, cliente) => {
  return NextResponse.json({ pedidos: await listarPedidosDeCliente(cliente.id) })
})
