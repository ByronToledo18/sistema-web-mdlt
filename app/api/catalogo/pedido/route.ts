import { NextResponse } from "next/server"
import { withCliente } from "@/server/auth/guard"
import { crearPedidoDesdeCatalogo } from "@/server/services/pedidos"
import { parseBody } from "@/server/validators/common"
import { crearPedidoCatalogoBody } from "@/server/validators/pedidos"

// POST - Checkout del catálogo (cliente del portal autenticado)
export const POST = withCliente(
  { error: "Error al crear el pedido", sinSesion: "Debes iniciar sesión para realizar un pedido" },
  async (request, _context, cliente) => {
    const input = await parseBody(request, crearPedidoCatalogoBody)
    const pedido = await crearPedidoDesdeCatalogo(cliente.id, input)
    return NextResponse.json({
      success: true,
      pedido: { id: pedido.id, codigo: pedido.codigo, total: pedido.total },
    })
  },
)
