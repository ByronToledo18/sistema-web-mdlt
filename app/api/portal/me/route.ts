import { NextResponse } from "next/server"
import { withCliente } from "@/server/auth/guard"
import { obtenerPerfilCliente } from "@/server/services/clientes"

// GET - Datos del cliente autenticado
export const GET = withCliente({ error: "Error al obtener cliente" }, async (_request, _context, cliente) => {
  return NextResponse.json({ cliente: await obtenerPerfilCliente(cliente.id) })
})
