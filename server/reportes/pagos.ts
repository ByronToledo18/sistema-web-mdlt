import { formatDate } from "@/components/admin/format"
import type { pagosPorRango } from "@/server/services/pagos"
import { seccion, type Reporte } from "./tipos"

type Pago = Awaited<ReturnType<typeof pagosPorRango>>[number]

interface PorMetodo {
  metodo: string
  cantidad: number
  total: number
}

// Detalle de cobros del rango y resumen por método de pago.
export function reportePagos(pagos: Pago[], desde: string, hasta: string): Reporte {
  const total = pagos.reduce((sum, p) => sum + Number(p.monto), 0)

  const metodos = new Map<string, PorMetodo>()
  for (const p of pagos) {
    const metodo = p.metodo || "Sin especificar"
    const fila = metodos.get(metodo) ?? { metodo, cantidad: 0, total: 0 }
    fila.cantidad++
    fila.total += Number(p.monto)
    metodos.set(metodo, fila)
  }

  return {
    titulo: "Reporte de cobros",
    subtitulo: `Del ${formatDate(desde, "short")} al ${formatDate(hasta, "short")}`,
    secciones: [
      seccion<Pago>({
        titulo: "Cobros",
        columnas: [
          { key: "id", titulo: "ID", tipo: "numero", ancho: 7 },
          { key: "fecha", titulo: "Fecha", tipo: "fecha", ancho: 12 },
          { key: "pedido_codigo", titulo: "Pedido", ancho: 16 },
          { key: "cliente_nombre", titulo: "Cliente", ancho: 30 },
          { key: "metodo", titulo: "Método", ancho: 16 },
          { key: "referencia", titulo: "Referencia", ancho: 20 },
          { key: "monto", titulo: "Monto", tipo: "moneda", ancho: 13 },
        ],
        filas: pagos,
        totales: { cliente_nombre: `Total (${pagos.length} cobros)`, monto: total },
      }),
      seccion<PorMetodo>({
        titulo: "Por método de pago",
        columnas: [
          { key: "metodo", titulo: "Método", ancho: 30 },
          { key: "cantidad", titulo: "Cobros", tipo: "numero", ancho: 12 },
          { key: "total", titulo: "Total", tipo: "moneda", ancho: 15 },
        ],
        filas: [...metodos.values()].sort((a, b) => b.total - a.total),
        totales: { metodo: "Total", cantidad: pagos.length, total },
      }),
    ],
  }
}
