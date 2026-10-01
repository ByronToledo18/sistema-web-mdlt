import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { alternarEstadoUsuario } from "@/server/services/usuarios"
import { idParams, parseParams } from "@/server/validators/common"

// POST - Activar/desactivar usuario (nunca el último administrador o soporte activo)
export const POST = withAuth<{ id: string }>(
  { permission: { module: "usuarios", action: "update" }, error: "Error al cambiar estado del usuario" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const activo = await alternarEstadoUsuario(id)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
      modulo: "usuarios",
      descripcion: `Usuario ID ${id} ${activo ? "activado" : "desactivado"}`,
    })

    return NextResponse.json({ success: true, activo })
  },
)
