import { NextResponse } from "next/server"
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

// POST - Crear ticket (público: lo usa "olvidé mi contraseña" del login)
export const POST = withErrors({ error: "Error al crear ticket" }, async (request) => {
  const input = await parseBody(request, crearTicketBody)
  return NextResponse.json(await crearTicket(input), { status: 201 })
})
