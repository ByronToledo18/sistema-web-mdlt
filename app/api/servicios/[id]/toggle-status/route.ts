import { NextResponse } from "next/server"
import { revalidarCatalogo } from "@/lib/catalogo-cache"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { alternarEstadoServicio } from "@/server/services/catalogo"
import { idParams, parseParams } from "@/server/validators/common"

// POST - Alternar estado activo/inactivo del servicio
export const POST = withAuth<{ id: string }>(
  { permission: { module: "servicios", action: "update" }, error: "Error al cambiar estado del servicio" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const activo = await alternarEstadoServicio(id)
    revalidarCatalogo()

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "update",
      modulo: "servicios",
      descripcion: `Servicio #${id}: estado cambiado a ${activo ? "activo" : "inactivo"}`,
    })

    return NextResponse.json({
      success: true,
      activo,
      message: `Servicio ${activo ? "activado" : "desactivado"} exitosamente`,
    })
  },
)
