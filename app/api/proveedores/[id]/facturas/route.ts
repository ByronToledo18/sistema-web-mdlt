import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { crearFacturaProveedor, listarFacturasProveedor } from "@/server/services/proveedores"
import { idParams, parseBody, parseParams, parseQuery } from "@/server/validators/common"
import { crearFacturaBody, listarFacturasQuery } from "@/server/validators/proveedores"

type Params = { id: string }

// GET - Listar facturas de un proveedor
export const GET = withAuth<Params>(
  { permission: { module: "proveedores", action: "read" }, error: "Error al obtener facturas" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const { estado } = parseQuery(request, listarFacturasQuery)
    return NextResponse.json({ facturas: await listarFacturasProveedor(id, estado) })
  },
)

// POST - Registrar factura de compra (suma al stock)
export const POST = withAuth<Params>(
  { permission: { module: "proveedores", action: "create" }, error: "Error al crear factura" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const input = await parseBody(request, crearFacturaBody)
    return NextResponse.json({ factura: await crearFacturaProveedor(id, input) }, { status: 201 })
  },
)
