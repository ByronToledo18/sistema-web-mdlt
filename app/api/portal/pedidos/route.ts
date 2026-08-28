import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getClienteFromToken } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const cliente = await getClienteFromToken()
    if (!cliente) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const pedidos = await sql`
      SELECT id, codigo, estado, total, fecha_creacion, created_at, updated_at
      FROM pedidos
      WHERE cliente_id = ${cliente.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ pedidos })
  } catch (error: any) {
    console.error("[v0] Get portal pedidos error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener pedidos" }, { status: 500 })
  }
}
