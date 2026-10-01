import "server-only"

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"
import { formatDateTime } from "@/components/admin/format"
import { textoCelda, type Reporte, type Seccion } from "./tipos"

// A4 horizontal, en puntos.
const ANCHO = 841.89
const ALTO = 595.28
const MARGEN = 36
const TAM = 9
const ALTO_FILA = 16
const ACENTO = rgb(0.616, 0.235, 0.447) // #9D3C72
const GRIS = rgb(0.4, 0.4, 0.4)
const FONDO_PAR = rgb(0.97, 0.95, 0.96)

// Las fuentes estándar usan WinAnsi: cubren tildes, ñ, ¿ y ¡, pero no emojis
// ni otros símbolos. Lo que no se puede codificar se cambia por "?".
function limpiar(texto: string, permitidos: Set<number>): string {
  let out = ""
  for (const ch of texto.replace(/[\r\n\t]+/g, " ")) out += permitidos.has(ch.codePointAt(0)!) ? ch : "?"
  return out
}

function recortar(texto: string, font: PDFFont, ancho: number): string {
  if (font.widthOfTextAtSize(texto, TAM) <= ancho) return texto
  let corto = texto
  while (corto.length > 0 && font.widthOfTextAtSize(`${corto}…`, TAM) > ancho) corto = corto.slice(0, -1)
  return `${corto}…`
}

export async function reportePdf(reporte: Reporte): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(reporte.titulo)
  pdf.setCreator("El Mundo de las Tutus")
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const permitidos = new Set(normal.getCharacterSet())
  const txt = (s: string) => limpiar(s, permitidos)

  let page: PDFPage = pdf.addPage([ANCHO, ALTO])
  let y = ALTO - MARGEN

  page.drawText(txt(reporte.titulo), { x: MARGEN, y: y - 14, size: 16, font: negrita, color: ACENTO })
  y -= 22
  if (reporte.subtitulo) {
    page.drawText(txt(reporte.subtitulo), { x: MARGEN, y: y - 10, size: 10, font: normal, color: GRIS })
    y -= 16
  }
  y -= 8

  const nuevaPagina = () => {
    page = pdf.addPage([ANCHO, ALTO])
    y = ALTO - MARGEN
  }

  for (const seccion of reporte.secciones) {
    const anchos = repartirAnchos(seccion)
    const xs = anchos.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? MARGEN : acc[i - 1] + anchos[i - 1]], [])

    const fila = (valores: string[], font: PDFFont, opciones: { fondo?: ReturnType<typeof rgb>; color?: ReturnType<typeof rgb> } = {}) => {
      if (opciones.fondo) {
        page.drawRectangle({ x: MARGEN, y: y - ALTO_FILA, width: ANCHO - 2 * MARGEN, height: ALTO_FILA, color: opciones.fondo })
      }
      valores.forEach((valor, i) => {
        const col = seccion.columnas[i]
        const texto = recortar(txt(valor), font, anchos[i] - 8)
        const derecha = col.tipo === "moneda" || col.tipo === "numero"
        const x = derecha ? xs[i] + anchos[i] - 4 - font.widthOfTextAtSize(texto, TAM) : xs[i] + 4
        page.drawText(texto, { x, y: y - ALTO_FILA + 5, size: TAM, font, color: opciones.color ?? rgb(0.1, 0.1, 0.1) })
      })
      y -= ALTO_FILA
    }
    const encabezado = () =>
      fila(
        seccion.columnas.map((c) => c.titulo),
        negrita,
        { fondo: ACENTO, color: rgb(1, 1, 1) },
      )

    // Título de sección + encabezado + al menos una fila deben caber juntos.
    if (y - 18 - 2 * ALTO_FILA < MARGEN + 14) nuevaPagina()
    page.drawText(txt(seccion.titulo), { x: MARGEN, y: y - 12, size: 11, font: negrita })
    y -= 18
    encabezado()

    if (seccion.filas.length === 0) {
      page.drawText("Sin registros en el período", { x: MARGEN + 4, y: y - ALTO_FILA + 5, size: TAM, font: normal, color: GRIS })
      y -= ALTO_FILA
    }

    seccion.filas.forEach((datos, n) => {
      if (y - ALTO_FILA < MARGEN + 14) {
        nuevaPagina()
        encabezado()
      }
      fila(
        seccion.columnas.map((c) => textoCelda(datos[c.key], c.tipo)),
        normal,
        { fondo: n % 2 === 1 ? FONDO_PAR : undefined },
      )
    })

    if (seccion.totales) {
      if (y - ALTO_FILA < MARGEN + 14) nuevaPagina()
      page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.75, color: GRIS })
      fila(
        seccion.columnas.map((c) => textoCelda(seccion.totales?.[c.key], c.tipo)),
        negrita,
      )
    }
    y -= 16
  }

  // Pie: fecha de generación y "Página x de n".
  const paginas = pdf.getPages()
  const generado = `Generado el ${formatDateTime(new Date(), "short")}`
  paginas.forEach((p, i) => {
    p.drawText(txt(generado), { x: MARGEN, y: MARGEN / 2, size: 8, font: normal, color: GRIS })
    const numero = `Página ${i + 1} de ${paginas.length}`
    p.drawText(txt(numero), { x: ANCHO - MARGEN - normal.widthOfTextAtSize(numero, 8), y: MARGEN / 2, size: 8, font: normal, color: GRIS })
  })

  return Buffer.from(await pdf.save())
}

function repartirAnchos(seccion: Seccion): number[] {
  const pesos = seccion.columnas.map((c) => c.ancho ?? 16)
  const total = pesos.reduce((a, b) => a + b, 0)
  return pesos.map((p) => ((ANCHO - 2 * MARGEN) * p) / total)
}
