import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { cambiarRolUsuario } from "@/server/services/usuarios"
import { idParams, parseBody, parseParams } from "@/server/validators/common"
import { cambiarRolBody } from "@/server/validators/usuarios"

// POST - Cambiar el rol de un usuario
export const POST = withAuth<{ id: string }>(
  { permission: { module: "usuarios", action: "update" }, error: "Error al cambiar rol" },
  async (request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const { rol_id } = await parseBody(request, cambiarRolBody)
    const usuario = await cambiarRolUsuario(id, rol_id)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "CAMBIO_ROL",
      modulo: "usuarios",
      descripcion: `Cambió el rol del usuario ${usuario.nombre} (${usuario.email})`,
    })

    return NextResponse.json({ success: true })
  },
)
