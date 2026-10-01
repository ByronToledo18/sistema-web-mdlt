import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { crearProveedor, listarProveedores } from "@/server/services/proveedores"
import { parseBody, parseQuery } from "@/server/validators/common"
import { listarProveedoresQuery, proveedorBody } from "@/server/validators/proveedores"

// GET - Listar proveedores
export const GET = withAuth(
  { permission: { module: "proveedores", action: "read" }, error: "Error al obtener proveedores" },
  async (request) => {
    const filtros = parseQuery(request, listarProveedoresQuery)
    return NextResponse.json({ proveedores: await listarProveedores(filtros) })
  },
)

// POST - Crear proveedor
export const POST = withAuth(
  { permission: { module: "proveedores", action: "create" }, error: "Error al crear proveedor" },
  async (request) => {
    const datos = await parseBody(request, proveedorBody)
    return NextResponse.json({ proveedor: await crearProveedor(datos) }, { status: 201 })
  },
)
