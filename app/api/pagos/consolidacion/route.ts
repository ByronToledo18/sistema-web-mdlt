import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { obtenerConsolidacionMensual } from "@/lib/pagos"

// GET - Obtener consolidación mensual
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { searchParams } = new URL(request.url)
    const year = Number.parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = Number.parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Mes inválido" }, { status: 400 })
    }

    const consolidacion = await obtenerConsolidacionMensual(year, month)

    return NextResponse.json({ consolidacion, year, month })
  } catch (error: any) {
    console.error("[v0] Get consolidacion error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener consolidación" }, { status: 500 })
  }
}
