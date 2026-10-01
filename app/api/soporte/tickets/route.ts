import { NextResponse } from "next/server"
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { withAuth, withErrors } from "@/server/auth/guard"
import { crearTicket, listarTickets } from "@/server/services/usuarios"
import { parseBody, parseQuery } from "@/server/validators/common"
import { crearTicketBody, ticketsQuery } from "@/server/validators/usuarios"

// GET - Listar tickets de soporte
export const GET = withAuth(
  { permission: { module: "sistema", action: "read" }, error: "Error al obtener tickets" },
  async (request) => {
    const { estado } = parseQuery(request, ticketsQuery)
    return NextResponse.json(await listarTickets(estado))
  },
)

// POST - Crear ticket (público). Tipos cerrados: los de reseteo de contraseña
// solo los crea el servidor (/api/auth/solicitar-reseteo y
// /api/portal/recuperar-password).
export const POST = withErrors({ error: "Error al crear ticket" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.soporteTicket)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }
  const input = await parseBody(request, crearTicketBody)
  return NextResponse.json(await crearTicket(input), { status: 201 })
})
