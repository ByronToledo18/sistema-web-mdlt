import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    console.log("[v0] GET /api/soporte/tickets - Starting")

    const user = await getCurrentUser()
    console.log("[v0] User from getCurrentUser:", user ? user.email : "null")

    if (!user) {
      console.log("[v0] No user found, returning 401")
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    if (user.rol !== "soporte" && user.rol !== "administrador") {
      console.log("[v0] User role not authorized:", user.rol)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get("estado")
    console.log("[v0] Fetching tickets with estado:", estado)

    let result
    if (estado) {
      result = await sql`
        SELECT 
          id,
          tipo,
          prioridad,
          descripcion,
          estado,
          email_contacto,
          created_at,
          updated_at
        FROM tickets
        WHERE estado = ${estado}
        ORDER BY created_at DESC
      `
    } else {
      result = await sql`
        SELECT 
          id,
          tipo,
          prioridad,
          descripcion,
          estado,
          email_contacto,
          created_at,
          updated_at
        FROM tickets
        ORDER BY created_at DESC
      `
    }

    console.log("[v0] Tickets query result:", result.length, "tickets found")
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error fetching tickets:", error)
    return NextResponse.json(
      {
        error: "Error al obtener tickets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tipo, prioridad, descripcion, email_contacto } = body

    if (!tipo || !prioridad || !descripcion) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO tickets (tipo, prioridad, descripcion, email_contacto, estado)
      VALUES (${tipo}, ${prioridad}, ${descripcion}, ${email_contacto || null}, 'pendiente')
      RETURNING *
    `

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating ticket:", error)
    return NextResponse.json({ error: "Error al crear ticket" }, { status: 500 })
  }
}
