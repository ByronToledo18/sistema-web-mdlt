import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { pagarServientrega } from "@/server/services/envios"
import { parseBody } from "@/server/validators/common"
import { pagarServientregaBody } from "@/server/validators/pagos"

// POST - Registrar pago a Servientrega
export const POST = withAuth(
  { permission: { module: "servientrega", action: "update" }, error: "Error al registrar pago" },
  async (request) => {
    await pagarServientrega(await parseBody(request, pagarServientregaBody))
    return NextResponse.json({ success: true })
  },
)
