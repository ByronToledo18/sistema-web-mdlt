import { type NextRequest, NextResponse } from "next/server"
import { sql, executeQuery } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Listar productos
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const activo = searchParams.get("activo")

    let queryText = `SELECT * FROM productos WHERE 1=1`
    const params: any[] = []
    let paramIndex = 1

    if (search) {
      queryText += ` AND (nombre ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (activo !== null && activo !== undefined && activo !== "") {
      queryText += ` AND activo = $${paramIndex}`
      params.push(activo === "true")
      paramIndex++
    }

    queryText += ` ORDER BY nombre ASC`

    const productos = await executeQuery(queryText, params)

    return NextResponse.json({ productos })
  } catch (error: any) {
    console.error("[v0] Get productos error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener productos" }, { status: 500 })
  }
}

// POST - Crear producto
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { sku, nombre, precio, stock, activo } = await request.json()

    if (!nombre || precio === undefined) {
      return NextResponse.json({ error: "Nombre y precio son requeridos" }, { status: 400 })
    }

    if (precio < 0) {
      return NextResponse.json({ error: "El precio no puede ser negativo" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO productos (sku, nombre, precio, stock, activo)
      VALUES (${sku || null}, ${nombre}, ${precio}, ${stock || 0}, ${activo !== false})
      RETURNING *
    `

    return NextResponse.json({ producto: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create producto error:", error)
    if (error.message?.includes("duplicate key")) {
      return NextResponse.json({ error: "El SKU ya existe" }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Error al crear producto" }, { status: 500 })
  }
}
