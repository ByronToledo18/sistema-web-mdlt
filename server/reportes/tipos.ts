// Descripción de un reporte tabular, común a Excel y PDF. Los builders no
// tocan la BD: reciben las filas ya consultadas y devuelven el archivo.

import { formatCurrency, formatDate } from "@/components/admin/format"

export type TipoColumna = "texto" | "numero" | "moneda" | "fecha"

export interface Columna<F extends object> {
  key: keyof F & string
  titulo: string
  tipo?: TipoColumna
  // Ancho relativo: en Excel son caracteres; en PDF, el reparto proporcional
  // del ancho de la página.
  ancho?: number
}

export interface Seccion<F extends object = Record<string, unknown>> {
  titulo: string
  columnas: Columna<F>[]
  filas: F[]
  // Fila de totales opcional, con las mismas claves que las columnas.
  totales?: Partial<Record<keyof F & string, unknown>>
}

export interface Reporte {
  titulo: string
  subtitulo?: string
  secciones: Seccion[]
}

// Valida las columnas contra el tipo de fila y la deja en la forma genérica
// que guardan los reportes (cada sección tiene su propio tipo de fila).
export function seccion<F extends object>(s: Seccion<F>): Seccion {
  return s as unknown as Seccion
}

// Texto de una celda para PDF (y para Excel cuando el tipo es texto).
export function textoCelda(valor: unknown, tipo: TipoColumna = "texto"): string {
  if (valor == null || valor === "") return ""
  switch (tipo) {
    case "moneda":
      return formatCurrency(typeof valor === "number" ? valor : String(valor))
    case "fecha":
      return formatDate(valor as string | Date, "short")
    case "numero":
      return Number(valor).toLocaleString("es-EC")
    default:
      return String(valor)
  }
}

// Fecha del calendario de Ecuador como medianoche UTC, que es como Excel
// guarda una fecha sin hora. Las columnas `date` llegan como "YYYY-MM-DD".
export function fechaCalendario(valor: string | Date): Date {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T00:00:00Z`)
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date(valor))
  return new Date(`${partes}T00:00:00Z`)
}
