import { NextResponse } from "next/server"
import { withCliente } from "@/server/auth/guard"
import { actualizarPerfilCliente } from "@/server/services/clientes"
import { perfilBody } from "@/server/validators/clientes"
import { parseBody } from "@/server/validators/common"

// PUT - Actualizar perfil del cliente autenticado
export const PUT = withCliente({ error: "Error al actualizar perfil" }, async (request, _context, cliente) => {
  const datos = await parseBody(request, perfilBody)
  return NextResponse.json({ cliente: await actualizarPerfilCliente(cliente.id, datos) })
})
