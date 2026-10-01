import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { actualizarProveedor, eliminarProveedor, obtenerProveedor } from "@/server/services/proveedores"
import { idParams, parseBody, parseParams } from "@/server/validators/common"
import { proveedorBody } from "@/server/validators/proveedores"

type Params = { id: string }

// GET - Obtener proveedor por ID
export const GET = withAuth<Params>(
  { permission: { module: "proveedores", action: "read" }, error: "Error al obtener proveedor" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ proveedor: await obtenerProveedor(id) })
  },
)

// PUT - Actualizar proveedor
export const PUT = withAuth<Params>(
  { permission: { module: "proveedores", action: "update" }, error: "Error al actualizar proveedor" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const datos = await parseBody(request, proveedorBody)
    return NextResponse.json({ proveedor: await actualizarProveedor(id, datos) })
  },
)

// DELETE - Eliminar proveedor (solo si no tiene facturas)
export const DELETE = withAuth<Params>(
  { permission: { module: "proveedores", action: "delete" }, error: "Error al eliminar proveedor" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    await eliminarProveedor(id)
    return NextResponse.json({ message: "Proveedor eliminado exitosamente" })
  },
)
