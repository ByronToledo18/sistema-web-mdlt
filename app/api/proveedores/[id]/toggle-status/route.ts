import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// POST - Toggle proveedor status
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])

    const { id } = await params

    const result = await sql`
      UPDATE proveedores
      SET activo = NOT activo
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ proveedor: result[0] })
  } catch (error: any) {
    console.error("[v0] Toggle proveedor status error:", error)
    return NextResponse.json({ error: error.message || "Error al cambiar estado del proveedor" }, { status: 500 })
  }
}
