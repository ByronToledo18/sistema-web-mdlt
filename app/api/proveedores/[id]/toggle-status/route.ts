import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { alternarEstadoProveedor } from "@/server/services/proveedores"
import { idParams, parseParams } from "@/server/validators/common"

// POST - Activar/desactivar proveedor
export const POST = withAuth<{ id: string }>(
  { permission: { module: "proveedores", action: "update" }, error: "Error al cambiar estado del proveedor" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ proveedor: await alternarEstadoProveedor(id) })
  },
)
