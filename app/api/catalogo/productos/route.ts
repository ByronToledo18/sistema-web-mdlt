import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const categoria = searchParams.get("categoria") || ""

    let query = sql`
      SELECT 
        id,
        sku,
        nombre,
        precio,
        stock,
        activo
      FROM productos
      WHERE activo = true
    `

    if (search) {
      query = sql`${query} AND (nombre ILIKE ${"%" + search + "%"} OR sku ILIKE ${"%" + search + "%"})`
    }

    if (categoria) {
      query = sql`${query} AND nombre ILIKE ${"%" + categoria + "%"}`
    }

    query = sql`${query} ORDER BY nombre ASC`

    const productos = await query

    return NextResponse.json(productos)
  } catch (error) {
    console.error("[v0] Error fetching catalog products:", error)
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 })
  }
}
