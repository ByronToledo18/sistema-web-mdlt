import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { crearCliente, listarClientes } from "@/server/services/clientes"
import { crearClienteBody, listarClientesQuery } from "@/server/validators/clientes"
import { parseBody, parseQuery } from "@/server/validators/common"

// GET - Listar clientes
export const GET = withAuth(
  { permission: { module: "clientes", action: "read" }, error: "Error al obtener clientes" },
  async (request) => {
    const filtros = parseQuery(request, listarClientesQuery)
    return NextResponse.json({ clientes: await listarClientes(filtros) })
  },
)

// POST - Crear cliente (con contraseña temporal para el portal)
export const POST = withAuth(
  { permission: { module: "clientes", action: "create" }, error: "Error al crear cliente" },
  async (request) => {
    const datos = await parseBody(request, crearClienteBody)
    const { cliente, tempPassword } = await crearCliente(datos)
    return NextResponse.json({ cliente, tempPassword }, { status: 201 })
  },
)
