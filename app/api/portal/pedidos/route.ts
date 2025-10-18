import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Check portal authentication
    const token = request.cookies.get("portal-auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get("cliente_id")

    if (!clienteId) {
      return NextResponse.json({ error: "Cliente ID requerido" }, { status: 400 })
    }

    const pedidos = await sql`
      SELECT id, codigo, estado, total, fecha_creacion, created_at, updated_at
      FROM pedidos
      WHERE cliente_id = ${clienteId}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ pedidos })
  } catch (error: any) {
    console.error("[v0] Get portal pedidos error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener pedidos" }, { status: 500 })
  }
}
