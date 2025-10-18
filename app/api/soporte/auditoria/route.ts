import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAuditLogs } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(["soporte", "administrador"])

    const { searchParams } = new URL(request.url)
    const modulo = searchParams.get("modulo") || undefined
    const accion = searchParams.get("accion") || undefined
    const usuario_id = searchParams.get("usuario_id") ? Number.parseInt(searchParams.get("usuario_id")!) : undefined
    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")!) : 100
    const offset = searchParams.get("offset") ? Number.parseInt(searchParams.get("offset")!) : 0

    const logs = await getAuditLogs({
      modulo,
      accion,
      usuario_id,
      limit,
      offset,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("[v0] Error fetching audit logs:", error)
    return NextResponse.json({ error: "Error al obtener logs de auditoría" }, { status: 500 })
  }
}
