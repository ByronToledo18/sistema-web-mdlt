import { type NextRequest, NextResponse } from "next/server"
import { sql, executeQuery } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Listar servicios
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const activo = searchParams.get("activo")

    let queryText = `SELECT * FROM servicios WHERE 1=1`
    const params: any[] = []
    let paramIndex = 1

    if (search) {
      queryText += ` AND nombre ILIKE $${paramIndex}`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (activo !== null && activo !== undefined && activo !== "") {
      queryText += ` AND activo = $${paramIndex}`
      params.push(activo === "true")
      paramIndex++
    }

    queryText += ` ORDER BY nombre ASC`

    const servicios = await executeQuery(queryText, params)

    return NextResponse.json({ servicios })
  } catch (error: any) {
    console.error("[v0] Get servicios error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener servicios" }, { status: 500 })
  }
}

// POST - Crear servicio
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { nombre, unidad, precio_base, variable, activo } = await request.json()

    if (!nombre || precio_base === undefined) {
      return NextResponse.json({ error: "Nombre y precio base son requeridos" }, { status: 400 })
    }

    if (precio_base < 0) {
      return NextResponse.json({ error: "El precio no puede ser negativo" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO servicios (nombre, unidad, precio_base, variable, activo)
      VALUES (${nombre}, ${unidad || null}, ${precio_base}, ${variable === true}, ${activo !== false})
      RETURNING *
    `

    return NextResponse.json({ servicio: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create servicio error:", error)
    return NextResponse.json({ error: error.message || "Error al crear servicio" }, { status: 500 })
  }
}
