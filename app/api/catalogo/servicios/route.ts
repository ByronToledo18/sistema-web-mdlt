import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    let query = sql`
      SELECT 
        id,
        nombre,
        unidad,
        precio_base,
        variable,
        activo
      FROM servicios
      WHERE activo = true
    `

    if (search) {
      query = sql`${query} AND nombre ILIKE ${"%" + search + "%"}`
    }

    query = sql`${query} ORDER BY nombre ASC`

    const servicios = await query

    return NextResponse.json(servicios)
  } catch (error) {
    console.error("[v0] Error fetching catalog services:", error)
    return NextResponse.json({ error: "Error al obtener servicios" }, { status: 500 })
  }
}
