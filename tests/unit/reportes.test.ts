import ExcelJS from "exceljs"
import { PDFDocument } from "pdf-lib"
import { describe, expect, test } from "vitest"
import { reporteExcel } from "@/server/reportes/excel"
import { reporteNomina } from "@/server/reportes/nomina"
import { reportePagos } from "@/server/reportes/pagos"
import { reportePdf } from "@/server/reportes/pdf"
import { fechaCalendario, seccion, type Reporte } from "@/server/reportes/tipos"

interface Fila {
  id: number
  fecha: string | Date
  cliente: string
  monto: string
}

function reporte(filas: Fila[]): Reporte {
  const total = filas.reduce((sum, f) => sum + Number(f.monto), 0)
  return {
    titulo: "Reporte de cobros",
    subtitulo: "Del 2026-09-01 al 2026-09-30",
    secciones: [
      seccion<Fila>({
        titulo: "Cobros",
        columnas: [
          { key: "id", titulo: "ID", tipo: "numero", ancho: 6 },
          { key: "fecha", titulo: "Fecha", tipo: "fecha", ancho: 12 },
          { key: "cliente", titulo: "Cliente", ancho: 30 },
          { key: "monto", titulo: "Monto", tipo: "moneda", ancho: 12 },
        ],
        filas,
        totales: { cliente: "Total", monto: total },
      }),
    ],
  }
}

const filas: Fila[] = [
  { id: 1, fecha: new Date("2026-09-01T04:30:00Z"), cliente: "María José Peñafiel", monto: "25.50" },
  { id: 2, fecha: "2026-09-15", cliente: "Ñandú ¿Café? ¡Sí!", monto: "100.00" },
]

describe("fechaCalendario", () => {
  test("un timestamp UTC se pasa al día de Ecuador", () => {
    // 01/09 04:30 UTC = 31/08 23:30 en Ecuador.
    expect(fechaCalendario(new Date("2026-09-01T04:30:00Z")).toISOString()).toBe("2026-08-31T00:00:00.000Z")
  })

  test("una columna date (YYYY-MM-DD) se queda en ese día", () => {
    expect(fechaCalendario("2026-09-15").toISOString()).toBe("2026-09-15T00:00:00.000Z")
  })
})

describe("reporteExcel", () => {
  test("escribe título, encabezados, filas tipadas y totales", async () => {
    const buffer = await reporteExcel(reporte(filas))

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const hoja = workbook.getWorksheet("Cobros")!

    expect(hoja.getCell("A1").value).toBe("Reporte de cobros")
    expect(hoja.getRow(4).values).toEqual([undefined, "ID", "Fecha", "Cliente", "Monto"])
    expect(hoja.getCell("A5").value).toBe(1)
    expect((hoja.getCell("B5").value as Date).toISOString()).toBe("2026-08-31T00:00:00.000Z")
    expect(hoja.getCell("C6").value).toBe("Ñandú ¿Café? ¡Sí!")
    expect(hoja.getCell("D5").value).toBe(25.5)
    expect(hoja.getCell("D5").numFmt).toBe('"$"#,##0.00')
    expect(hoja.getCell("C7").value).toBe("Total")
    expect(hoja.getCell("D7").value).toBe(125.5)
  })

  test("sin filas genera la hoja solo con encabezados", async () => {
    const buffer = await reporteExcel(reporte([]))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const hoja = workbook.getWorksheet("Cobros")!
    expect(hoja.getRow(4).getCell(1).value).toBe("ID")
    expect(hoja.getCell("D5").value).toBe(0)
  })
})

describe("reportePdf", () => {
  test("genera un PDF válido con tildes y ñ", async () => {
    const buffer = await reportePdf(reporte(filas))
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    const pdf = await PDFDocument.load(buffer)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getTitle()).toBe("Reporte de cobros")
  })

  test("pagina cuando hay muchas filas", async () => {
    const muchas = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      fecha: "2026-09-01",
      cliente: `Cliente ${i + 1}`,
      monto: "10.00",
    }))
    const pdf = await PDFDocument.load(await reportePdf(reporte(muchas)))
    expect(pdf.getPageCount()).toBeGreaterThan(5)
  })

  test("no falla con caracteres fuera de WinAnsi (emojis) ni con textos largos", async () => {
    const raras = [{ id: 1, fecha: "2026-09-01", cliente: `Tutú 🎀 ${"muy largo ".repeat(40)}`, monto: "1.00" }]
    const buffer = await reportePdf(reporte(raras))
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
  })
})

describe("reportePagos", () => {
  const base = { pedido_id: 1, pedido_codigo: "P-1", cliente_nombre: "Ana", referencia: null }

  test("totaliza y agrupa por método", () => {
    const reporte = reportePagos(
      [
        { ...base, id: 1, monto: "10.00", metodo: "efectivo", fecha: new Date("2026-09-02T15:00:00Z") },
        { ...base, id: 2, monto: "25.50", metodo: "transferencia", fecha: new Date("2026-09-03T15:00:00Z") },
        { ...base, id: 3, monto: "5.00", metodo: null, fecha: new Date("2026-09-04T15:00:00Z") },
        { ...base, id: 4, monto: "4.50", metodo: "efectivo", fecha: new Date("2026-09-05T15:00:00Z") },
      ],
      "2026-09-01",
      "2026-09-30",
    )
    // Los días del rango no se corren al anterior por la zona horaria.
    expect(reporte.subtitulo).toMatch(/^Del 1 .* al 30 /)
    expect(reporte.secciones[0].totales).toMatchObject({ monto: 45 })
    expect(reporte.secciones[1].filas).toEqual([
      { metodo: "transferencia", cantidad: 1, total: 25.5 },
      { metodo: "efectivo", cantidad: 2, total: 14.5 },
      { metodo: "Sin especificar", cantidad: 1, total: 5 },
    ])
  })
})

describe("reporteNomina", () => {
  const base = { persona_id: null, pedido_id: null, pedido_codigo: null, created_at: null }

  test("deducciones en negativo y consolidado por persona", () => {
    const reporte = reporteNomina(
      [
        { ...base, id: 1, persona_tipo: "madre", concepto: "Semana 1", monto: "50.00", fecha: "2026-09-05", tipo: "pago" },
        { ...base, id: 2, persona_tipo: "madre", concepto: "Adelanto", monto: "10.00", fecha: "2026-09-06", tipo: "deduccion" },
        { ...base, id: 3, persona_tipo: "costurera_externa", concepto: "Tutús", monto: "80.00", fecha: "2026-09-07", tipo: "pago" },
        { ...base, id: 4, persona_tipo: "costurera_externa", concepto: "Extra", monto: "5.00", fecha: "2026-09-08", tipo: "bono" },
      ],
      "2026-09-01",
      "2026-09-30",
    )
    const [consolidado, detalle] = reporte.secciones
    expect(consolidado.filas).toEqual([
      { persona: "Costurera Externa", movimientos: 2, pagado: 85, deducido: 0, neto: 85 },
      { persona: "Madre de la Emprendedora", movimientos: 2, pagado: 50, deducido: 10, neto: 40 },
    ])
    expect(consolidado.totales).toMatchObject({ movimientos: 4, pagado: 135, deducido: 10, neto: 125 })
    expect(detalle.filas.map((f) => f.monto)).toEqual([50, -10, 80, 5])
    expect(detalle.totales).toMatchObject({ monto: 125 })
  })

  test("el filtro de persona aparece en el subtítulo", () => {
    expect(reporteNomina([], "2026-09-01", "2026-09-30", "madre").subtitulo).toMatch(/^Madre de la Emprendedora · Del 1 /)
  })
})
