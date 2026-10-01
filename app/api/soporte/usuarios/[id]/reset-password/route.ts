import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { resetearPasswordUsuario } from "@/server/services/usuarios"
import { idParams, parseBody, parseParams } from "@/server/validators/common"
import { resetPasswordBody } from "@/server/validators/usuarios"

// POST - Resetear la contraseña de un usuario interno
export const POST = withAuth<{ id: string }>(
  { permission: { module: "usuarios", action: "update" }, error: "Error al resetear contraseña" },
  async (request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const { nueva_password } = await parseBody(request, resetPasswordBody)
    await resetearPasswordUsuario(id, nueva_password)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "RESET_PASSWORD",
      modulo: "usuarios",
      descripcion: `Contraseña reseteada para usuario ID ${id}`,
    })

    return NextResponse.json({ success: true, message: "Contraseña actualizada correctamente" })
  },
)
