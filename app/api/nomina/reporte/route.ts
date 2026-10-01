import { withAuth } from "@/server/auth/guard"
import { reporteNomina } from "@/server/reportes/nomina"
import { descargaReporte } from "@/server/reportes/respuesta"
import { movimientosPorRango } from "@/server/services/nomina"
import { parseQuery } from "@/server/validators/common"
import { reporteNominaQuery } from "@/server/validators/nomina"

// GET - Reporte de nómina de un rango de fechas (Excel o PDF)
export const GET = withAuth(
  { permission: { module: "nomina", action: "read" }, error: "Error al generar reporte" },
  async (request) => {
    const query = parseQuery(request, reporteNominaQuery)
    // isoDate solo valida el inicio de la cadena: nos quedamos con YYYY-MM-DD.
    const desde = query.fecha_desde.slice(0, 10)
    const hasta = query.fecha_hasta.slice(0, 10)
    const persona = query.persona_tipo && query.persona_tipo !== "todos" ? query.persona_tipo : undefined

    const movimientos = await movimientosPorRango(desde, hasta, persona)
    return descargaReporte(reporteNomina(movimientos, desde, hasta, persona), query.format, `reporte-nomina-${desde}-${hasta}`)
  },
)
