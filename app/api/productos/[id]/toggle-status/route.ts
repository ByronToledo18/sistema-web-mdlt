import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { alternarEstadoProducto } from "@/server/services/catalogo"
import { idParams, parseParams } from "@/server/validators/common"

// POST - Alternar estado activo/inactivo del producto
export const POST = withAuth<{ id: string }>(
  { permission: { module: "productos", action: "update" }, error: "Error al cambiar estado del producto" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const activo = await alternarEstadoProducto(id)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "update",
      modulo: "productos",
      descripcion: `Producto #${id}: estado cambiado a ${activo ? "activo" : "inactivo"}`,
    })

    return NextResponse.json({
      success: true,
      activo,
      message: `Producto ${activo ? "activado" : "desactivado"} exitosamente`,
    })
  },
)
