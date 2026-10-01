import "server-only"

import { NextResponse } from "next/server"
import { reporteExcel } from "./excel"
import { reportePdf } from "./pdf"
import type { Reporte } from "./tipos"

export type FormatoArchivo = "xlsx" | "pdf"

const CONTENT_TYPE: Record<FormatoArchivo, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
}

// Genera el archivo y lo devuelve como descarga. `nombre` va sin extensión; se
// limpia porque suele llevar fechas de la query (isoDate solo valida el inicio).
export async function descargaReporte(reporte: Reporte, formato: FormatoArchivo, nombre: string) {
  const seguro = nombre.replace(/[^\w.-]+/g, "_")
  const archivo = formato === "xlsx" ? await reporteExcel(reporte) : await reportePdf(reporte)
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": CONTENT_TYPE[formato],
      "Content-Disposition": `attachment; filename="${seguro}.${formato}"`,
      "Cache-Control": "no-store",
    },
  })
}
