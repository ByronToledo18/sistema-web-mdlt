import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Listar proveedores
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const mostrarInactivos = searchParams.get("mostrarInactivos") === "true"

    let proveedores

    if (search) {
      proveedores = await sql`
        SELECT * FROM proveedores
        WHERE (nombre ILIKE ${`%${search}%`} OR ruc ILIKE ${`%${search}%`} OR email ILIKE ${`%${search}%`})
        ${mostrarInactivos ? sql`` : sql`AND activo = true`}
        ORDER BY nombre ASC
      `
    } else {
      proveedores = await sql`
        SELECT * FROM proveedores
        ${mostrarInactivos ? sql`` : sql`WHERE activo = true`}
        ORDER BY nombre ASC
      `
    }

    return NextResponse.json({ proveedores })
  } catch (error: any) {
    console.error("[v0] Get proveedores error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener proveedores" }, { status: 500 })
  }
}

// POST - Crear proveedor
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { nombre, ruc, telefono, email, direccion, contacto_nombre, contacto_telefono, notas } = await request.json()

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    if (ruc) {
      const existing = await sql`SELECT id FROM proveedores WHERE ruc = ${ruc}`
      if (existing.length > 0) {
        return NextResponse.json({ error: "El RUC ya está registrado" }, { status: 400 })
      }
    }

    const result = await sql`
      INSERT INTO proveedores (nombre, ruc, telefono, email, direccion, contacto_nombre, contacto_telefono, notas)
      VALUES (${nombre}, ${ruc || null}, ${telefono || null}, ${email || null}, ${direccion || null}, ${contacto_nombre || null}, ${contacto_telefono || null}, ${notas || null})
      RETURNING *
    `

    return NextResponse.json({ proveedor: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create proveedor error:", error)
    return NextResponse.json({ error: error.message || "Error al crear proveedor" }, { status: 500 })
  }
}
