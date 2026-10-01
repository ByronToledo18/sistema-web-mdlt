import "server-only"

import ExcelJS from "exceljs"
import { fechaCalendario, type Reporte } from "./tipos"

const FORMATO: Record<string, string> = {
  moneda: '"$"#,##0.00',
  numero: "#,##0",
  fecha: "dd/mm/yyyy",
}

function valorCelda(valor: unknown, tipo?: string): ExcelJS.CellValue {
  if (valor == null || valor === "") return null
  if (tipo === "moneda" || tipo === "numero") return Number(valor)
  if (tipo === "fecha") return fechaCalendario(valor as string | Date)
  return String(valor)
}

// Nombre de hoja válido en Excel: máx. 31 caracteres y sin : \ / ? * [ ].
function nombreHoja(titulo: string, usados: Set<string>): string {
  const base = titulo.replace(/[:\/?*[\]]/g, " ").slice(0, 31).trim() || "Hoja"
  let nombre = base
  for (let i = 2; usados.has(nombre); i++) nombre = `${base.slice(0, 28)} ${i}`
  usados.add(nombre)
  return nombre
}

// Una hoja por sección: título, subtítulo, encabezados, filas y totales.
export async function reporteExcel(reporte: Reporte): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "El Mundo de las Tutus"
  workbook.created = new Date()
  const usados = new Set<string>()

  for (const seccion of reporte.secciones) {
    const hoja = workbook.addWorksheet(nombreHoja(seccion.titulo, usados))
    hoja.columns = seccion.columnas.map((c) => ({ key: c.key, width: c.ancho ?? 16, style: { numFmt: FORMATO[c.tipo ?? ""] } }))

    hoja.addRow([reporte.titulo]).font = { bold: true, size: 14 }
    hoja.addRow([reporte.subtitulo ? `${seccion.titulo} · ${reporte.subtitulo}` : seccion.titulo]).font = { italic: true }
    hoja.addRow([])

    const encabezado = hoja.addRow(seccion.columnas.map((c) => c.titulo))
    encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } }
    encabezado.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9D3C72" } }
    })
    const filaEncabezado = encabezado.number

    for (const fila of seccion.filas) {
      hoja.addRow(seccion.columnas.map((c) => valorCelda(fila[c.key], c.tipo)))
    }

    if (seccion.totales) {
      const totales = hoja.addRow(seccion.columnas.map((c) => valorCelda(seccion.totales?.[c.key], c.tipo)))
      totales.font = { bold: true }
      totales.border = { top: { style: "thin" } }
    }

    hoja.views = [{ state: "frozen", ySplit: filaEncabezado }]
    if (seccion.filas.length > 0) {
      hoja.autoFilter = {
        from: { row: filaEncabezado, column: 1 },
        to: { row: filaEncabezado + seccion.filas.length, column: seccion.columnas.length },
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
