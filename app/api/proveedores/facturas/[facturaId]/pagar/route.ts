import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { pagarFacturaProveedor } from "@/server/services/proveedores"
import { parseBody, parseParams } from "@/server/validators/common"
import { facturaParams, pagoFacturaBody } from "@/server/validators/proveedores"

// POST - Registrar pago a factura de proveedor
export const POST = withAuth<{ facturaId: string }>(
  { permission: { module: "proveedores", action: "update" }, error: "Error al registrar pago" },
  async (request, { params }) => {
    const { facturaId } = await parseParams(params, facturaParams)
    const input = await parseBody(request, pagoFacturaBody)
    return NextResponse.json({ factura: await pagarFacturaProveedor(facturaId, input) })
  },
)
