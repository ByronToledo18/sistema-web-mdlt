import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { crearEnvio, listarEnvios } from "@/server/services/envios"
import { parseBody, parseQuery } from "@/server/validators/common"
import { crearEnvioBody, pedidoIdQuery } from "@/server/validators/pagos"

// GET - Listar envíos (opcionalmente de un pedido)
export const GET = withAuth(
  { permission: { module: "envios", action: "read" }, error: "Error al obtener envíos" },
  async (request) => {
    const { pedido_id } = parseQuery(request, pedidoIdQuery)
    return NextResponse.json({ envios: await listarEnvios(pedido_id) })
  },
)

// POST - Crear envío manual para un pedido
export const POST = withAuth(
  { permission: { module: "envios", action: "create" }, error: "Error al crear envío" },
  async (request, _context, user) => {
    const input = await parseBody(request, crearEnvioBody)
    return NextResponse.json({ envio: await crearEnvio(user, input) }, { status: 201 })
  },
)
