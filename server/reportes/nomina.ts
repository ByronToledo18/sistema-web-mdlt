import { formatDate } from "@/components/admin/format"
import { personaTipoLabels } from "@/components/admin/nomina/personas"
import type { movimientosPorRango } from "@/server/services/nomina"
import { seccion, type Reporte } from "./tipos"

type Movimiento = Awaited<ReturnType<typeof movimientosPorRango>>[number]

interface FilaMovimiento {
  fecha: string
  persona: string
  tipo: string
  concepto: string
  pedido: string
  // Las deducciones van en negativo para que la columna sume el neto.
  monto: number
}

interface FilaPersona {
  persona: string
  movimientos: number
  pagado: number
  deducido: number
  neto: number
}

const TIPOS: Record<string, string> = { pago: "Pago", bono: "Bono", deduccion: "Deducción" }

const persona = (tipo: string) => personaTipoLabels[tipo] ?? tipo

// Detalle de movimientos del rango y consolidado por persona.
export function reporteNomina(movimientos: Movimiento[], desde: string, hasta: string, personaTipo?: string): Reporte {
  const filas: FilaMovimiento[] = movimientos.map((m) => ({
    fecha: m.fecha,
    persona: persona(m.persona_tipo),
    tipo: TIPOS[m.tipo ?? ""] ?? m.tipo ?? "",
    concepto: m.concepto,
    pedido: m.pedido_codigo ?? "",
    monto: m.tipo === "deduccion" ? -Number(m.monto) : Number(m.monto),
  }))

  const porPersona = new Map<string, FilaPersona>()
  for (const m of movimientos) {
    const fila = porPersona.get(m.persona_tipo) ?? { persona: persona(m.persona_tipo), movimientos: 0, pagado: 0, deducido: 0, neto: 0 }
    fila.movimientos++
    if (m.tipo === "deduccion") fila.deducido += Number(m.monto)
    else fila.pagado += Number(m.monto)
    fila.neto = fila.pagado - fila.deducido
    porPersona.set(m.persona_tipo, fila)
  }
  const personas = [...porPersona.values()].sort((a, b) => b.neto - a.neto)
  const suma = (k: "pagado" | "deducido" | "neto") => personas.reduce((s, p) => s + p[k], 0)

  const rango = `Del ${formatDate(desde, "short")} al ${formatDate(hasta, "short")}`
  return {
    titulo: "Reporte de nómina",
    subtitulo: personaTipo ? `${persona(personaTipo)} · ${rango}` : rango,
    secciones: [
      seccion<FilaPersona>({
        titulo: "Consolidado por persona",
        columnas: [
          { key: "persona", titulo: "Persona", ancho: 30 },
          { key: "movimientos", titulo: "Movimientos", tipo: "numero", ancho: 13 },
          { key: "pagado", titulo: "Pagos y bonos", tipo: "moneda", ancho: 15 },
          { key: "deducido", titulo: "Deducciones", tipo: "moneda", ancho: 15 },
          { key: "neto", titulo: "Neto", tipo: "moneda", ancho: 15 },
        ],
        filas: personas,
        totales: {
          persona: "Total",
          movimientos: movimientos.length,
          pagado: suma("pagado"),
          deducido: suma("deducido"),
          neto: suma("neto"),
        },
      }),
      seccion<FilaMovimiento>({
        titulo: "Movimientos",
        columnas: [
          { key: "fecha", titulo: "Fecha", tipo: "fecha", ancho: 12 },
          { key: "persona", titulo: "Persona", ancho: 22 },
          { key: "tipo", titulo: "Tipo", ancho: 11 },
          { key: "concepto", titulo: "Concepto", ancho: 40 },
          { key: "pedido", titulo: "Pedido", ancho: 14 },
          { key: "monto", titulo: "Monto", tipo: "moneda", ancho: 13 },
        ],
        filas,
        totales: { concepto: "Neto del período", monto: suma("neto") },
      }),
    ],
  }
}
