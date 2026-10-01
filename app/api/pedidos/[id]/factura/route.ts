import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { generarFactura, obtenerFactura } from "@/server/services/pedidos"
import { idParams, parseParams } from "@/server/validators/common"

type Params = { id: string }

// GET - Obtener la factura de un pedido (si existe)
export const GET = withAuth<Params>(
  { permission: { module: "pedidos", action: "read" }, error: "Error al obtener factura" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ factura: await obtenerFactura(id) })
  },
)

// POST - Generar la factura de un pedido a partir de sus pedido_items
export const POST = withAuth<Params>(
  { permission: { module: "pedidos", action: "create" }, error: "Error al generar factura" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ factura: await generarFactura(user, id) }, { status: 201 })
  },
)
