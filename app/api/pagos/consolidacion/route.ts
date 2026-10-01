import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { consolidacionMensual } from "@/server/services/pagos"
import { parseQuery } from "@/server/validators/common"
import { periodoQuery } from "@/server/validators/pagos"

// GET - Obtener consolidación mensual
export const GET = withAuth(
  { permission: { module: "cobros", action: "read" }, error: "Error al obtener consolidación" },
  async (request) => {
    const { year, month } = parseQuery(request, periodoQuery)
    return NextResponse.json({ consolidacion: await consolidacionMensual(year, month), year, month })
  },
)
