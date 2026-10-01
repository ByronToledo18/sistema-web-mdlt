import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { reportePagos } from "@/server/reportes/pagos"
import { descargaReporte } from "@/server/reportes/respuesta"
import { pagosPorRango } from "@/server/services/pagos"
import { parseQuery } from "@/server/validators/common"
import { reporteQuery } from "@/server/validators/pagos"

// Escapa un valor para CSV (comas, comillas y saltos de línea).
function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// GET - Generar reporte de pagos (JSON, CSV, Excel o PDF)
export const GET = withAuth(
  { permission: { module: "cobros", action: "read" }, error: "Error al generar reporte" },
  async (request) => {
    const { start_date, end_date, format } = parseQuery(request, reporteQuery)
    const pagos = await pagosPorRango(start_date, end_date)
    const total = pagos.reduce((sum, pago) => sum + Number.parseFloat(pago.monto), 0)

    if (format === "xlsx" || format === "pdf") {
      return descargaReporte(reportePagos(pagos, start_date, end_date), format, `reporte-cobros-${start_date}-${end_date}`)
    }

    if (format === "csv") {
      const headers = ["ID", "Fecha", "Pedido", "Cliente", "Monto", "Método", "Referencia"]
      const rows = pagos.map((pago) => [
        pago.id,
        pago.fecha ? new Date(pago.fecha).toLocaleDateString("es-EC") : "",
        pago.pedido_codigo,
        pago.cliente_nombre,
        pago.monto,
        pago.metodo,
        pago.referencia,
      ])
      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="reporte-pagos-${start_date}-${end_date}.csv"`,
        },
      })
    }

    return NextResponse.json({
      pagos,
      resumen: {
        total_pagos: total,
        cantidad_pagos: pagos.length,
        fecha_inicio: start_date,
        fecha_fin: end_date,
      },
    })
  },
)
