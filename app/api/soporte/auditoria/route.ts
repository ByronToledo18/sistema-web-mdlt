import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { listarAuditoria } from "@/server/services/auditoria"
import { parseQuery } from "@/server/validators/common"
import { auditoriaQuery } from "@/server/validators/usuarios"

// GET - Logs de auditoría con filtros
export const GET = withAuth(
  { permission: { module: "auditoria", action: "read" }, error: "Error al obtener logs de auditoría" },
  async (request) => {
    const filtros = parseQuery(request, auditoriaQuery)
    return NextResponse.json(await listarAuditoria(filtros))
  },
)
