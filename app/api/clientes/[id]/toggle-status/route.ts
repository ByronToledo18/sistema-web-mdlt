import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { alternarEstadoCliente } from "@/server/services/clientes"
import { idParams, parseParams } from "@/server/validators/common"

// POST - Activar/desactivar cliente
export const POST = withAuth<{ id: string }>(
  { permission: { module: "clientes", action: "delete" }, error: "Error al cambiar estado del cliente" },
  async (_request, { params }, user) => {
    const { id } = await parseParams(params, idParams)
    const activo = await alternarEstadoCliente(id)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: activo ? "ACTIVAR_CLIENTE" : "DESACTIVAR_CLIENTE",
      modulo: "clientes",
      descripcion: `Cliente ID ${id} ${activo ? "activado" : "desactivado"}`,
    })

    return NextResponse.json({ success: true, activo })
  },
)
