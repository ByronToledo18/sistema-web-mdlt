import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { agregarEnvioACuenta, consolidacionServientrega } from "@/server/services/envios"
import { parseBody, parseQuery } from "@/server/validators/common"
import { agregarEnvioACuentaBody, periodoQuery } from "@/server/validators/pagos"

// GET - Obtener consolidación de Servientrega del mes
export const GET = withAuth(
  { permission: { module: "servientrega", action: "read" }, error: "Error al obtener consolidación" },
  async (request) => {
    const { year, month } = parseQuery(request, periodoQuery)
    return NextResponse.json({ ...(await consolidacionServientrega(year, month)), year, month })
  },
)

// POST - Agregar envío a cuenta Servientrega
export const POST = withAuth(
  { permission: { module: "servientrega", action: "create" }, error: "Error al agregar a cuenta" },
  async (request) => {
    await agregarEnvioACuenta(await parseBody(request, agregarEnvioACuentaBody))
    return NextResponse.json({ success: true })
  },
)
