import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { listarPagos, registrarPago } from "@/server/services/pagos"
import { parseBody, parseQuery } from "@/server/validators/common"
import { pedidoIdQuery, registrarPagoBody } from "@/server/validators/pagos"

// GET - Listar pagos (opcionalmente de un pedido)
export const GET = withAuth(
  { permission: { module: "pagos", action: "read" }, error: "Error al obtener pagos" },
  async (request) => {
    const { pedido_id } = parseQuery(request, pedidoIdQuery)
    return NextResponse.json({ pagos: await listarPagos(pedido_id) })
  },
)

// POST - Registrar pago
export const POST = withAuth(
  { permission: { module: "pagos", action: "create" }, error: "Error al registrar pago" },
  async (request, _context, user) => {
    const input = await parseBody(request, registrarPagoBody)
    return NextResponse.json({ pago: await registrarPago(user, input) }, { status: 201 })
  },
)
