import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { anularFacturaProveedor, obtenerFacturaProveedor } from "@/server/services/proveedores"
import { parseParams } from "@/server/validators/common"
import { facturaParams } from "@/server/validators/proveedores"

type Params = { facturaId: string }

// GET - Obtener factura con ítems y pagos
export const GET = withAuth<Params>(
  { permission: { module: "proveedores", action: "read" }, error: "Error al obtener factura" },
  async (_request, { params }) => {
    const { facturaId } = await parseParams(params, facturaParams)
    return NextResponse.json(await obtenerFacturaProveedor(facturaId))
  },
)

// DELETE - Anular factura (descuenta del stock lo que había ingresado)
export const DELETE = withAuth<Params>(
  { permission: { module: "proveedores", action: "delete" }, error: "Error al anular factura" },
  async (_request, { params }) => {
    const { facturaId } = await parseParams(params, facturaParams)
    return NextResponse.json({ factura: await anularFacturaProveedor(facturaId) })
  },
)
