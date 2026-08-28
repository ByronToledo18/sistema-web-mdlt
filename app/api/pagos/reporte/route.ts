import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { obtenerPagosPorRango } from "@/lib/pagos"

// GET - Generar reporte de pagos
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get("start_date")
    const endDateStr = searchParams.get("end_date")
    const format = searchParams.get("format") || "json"

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: "Fechas de inicio y fin son requeridas" }, { status: 400 })
    }

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    if (startDate > endDate) {
      return NextResponse.json({ error: "La fecha de inicio debe ser menor a la fecha de fin" }, { status: 400 })
    }

    const pagos = await obtenerPagosPorRango(startDate, endDate)

    // Calcular totales
    const total = pagos.reduce((sum: number, pago: any) => sum + Number.parseFloat(pago.monto), 0)

    if (format === "csv") {
      // Generar CSV
      const headers = ["ID", "Fecha", "Pedido", "Cliente", "Monto", "Método", "Referencia"]
      const rows = pagos.map((pago: any) => [
        pago.id,
        new Date(pago.fecha).toLocaleDateString("es-EC"),
        pago.pedido_codigo,
        pago.cliente_nombre,
        pago.monto,
        pago.metodo || "",
        pago.referencia || "",
      ])

      const csv = [headers.join(","), ...rows.map((row: any[]) => row.join(","))].join("\n")

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="reporte-pagos-${startDateStr}-${endDateStr}.csv"`,
        },
      })
    }

    return NextResponse.json({
      pagos,
      resumen: {
        total_pagos: total,
        cantidad_pagos: pagos.length,
        fecha_inicio: startDateStr,
        fecha_fin: endDateStr,
      },
    })
  } catch (error: any) {
    console.error("[v0] Get reporte error:", error)
    return NextResponse.json({ error: error.message || "Error al generar reporte" }, { status: 500 })
  }
}
