import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { eliminarUsuario } from "@/server/services/usuarios"
import { idParams, parseParams } from "@/server/validators/common"

// DELETE - Eliminar usuario (nunca el último administrador o soporte activo)
export const DELETE = withAuth<{ id: string }>(
  { permission: { module: "usuarios", action: "delete" }, error: "Error al eliminar usuario" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const eliminado = await eliminarUsuario(id)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "ELIMINAR_USUARIO",
      modulo: "usuarios",
      descripcion: `Eliminó al usuario ${eliminado.nombre} (${eliminado.email})`,
    })

    return NextResponse.json({ success: true })
  },
)
