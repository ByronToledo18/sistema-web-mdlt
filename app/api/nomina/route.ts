import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { consolidadoPorPersona, listarMovimientos, registrarMovimiento } from "@/server/services/nomina"
import { parseBody, parseQuery } from "@/server/validators/common"
import { nominaQuery, registrarMovimientoBody } from "@/server/validators/nomina"

// GET - Listar movimientos de nómina (con filtros) o consolidado por persona
export const GET = withAuth(
  { permission: { module: "nomina", action: "read" }, error: "Error al obtener movimientos de nómina" },
  async (request) => {
    const filtros = parseQuery(request, nominaQuery)
    if (filtros.vista === "consolidado") {
      return NextResponse.json({ consolidado: await consolidadoPorPersona(filtros.fecha_desde, filtros.fecha_hasta) })
    }
    return NextResponse.json({ movimientos: await listarMovimientos(filtros) })
  },
)

// POST - Registrar movimiento de nómina
export const POST = withAuth(
  { permission: { module: "nomina", action: "create" }, error: "Error al registrar movimiento" },
  async (request, _context, user) => {
    const input = await parseBody(request, registrarMovimientoBody)
    const movimiento = await registrarMovimiento(input)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "crear",
      modulo: "nomina",
      descripcion: `Registró movimiento de nómina (${input.tipo}) por $${input.monto} - ${input.concepto}`,
    })

    return NextResponse.json({ movimiento }, { status: 201 })
  },
)
