import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(["soporte", "administrador"])

    const roles = await sql`
      SELECT id, nombre
      FROM roles
      ORDER BY nombre ASC
    `

    return NextResponse.json(roles)
  } catch (error: any) {
    console.error("[v0] Get roles error:", error)
    return NextResponse.json(
      { error: error.message || "Error al obtener roles" },
      { status: error.message?.includes("No autorizado") ? 401 : 500 },
    )
  }
}
