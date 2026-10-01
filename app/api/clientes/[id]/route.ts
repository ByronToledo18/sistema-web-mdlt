import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { actualizarCliente, obtenerCliente } from "@/server/services/clientes"
import { actualizarClienteBody } from "@/server/validators/clientes"
import { idParams, parseBody, parseParams } from "@/server/validators/common"

type Params = { id: string }

// GET - Obtener un cliente por ID
export const GET = withAuth<Params>(
  { permission: { module: "clientes", action: "read" }, error: "Error al obtener cliente" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ cliente: await obtenerCliente(id) })
  },
)

// PUT - Actualizar cliente
export const PUT = withAuth<Params>(
  { permission: { module: "clientes", action: "update" }, error: "Error al actualizar cliente" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const datos = await parseBody(request, actualizarClienteBody)
    return NextResponse.json({ cliente: await actualizarCliente(id, datos) })
  },
)
