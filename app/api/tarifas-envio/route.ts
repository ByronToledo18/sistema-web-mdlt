import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const tarifas = await sql`
      SELECT id, ciudad, provincia, costo
      FROM tarifas_envio
      WHERE activo = true
      ORDER BY ciudad ASC
    `

    return NextResponse.json({ tarifas })
  } catch (error: any) {
    console.error("[v0] Get tarifas error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener tarifas" }, { status: 500 })
  }
}
