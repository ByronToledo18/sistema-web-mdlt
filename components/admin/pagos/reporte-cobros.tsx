"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { descargarArchivo } from "@/components/admin/descargar-archivo"

type Formato = "xlsx" | "pdf" | "csv"

// Descarga el reporte de /api/pagos/reporte (la ruta se mantiene: devuelve un archivo).
export function ReporteCobros() {
  const [reportStartDate, setReportStartDate] = useState("")
  const [reportEndDate, setReportEndDate] = useState("")
  const [descargando, setDescargando] = useState<Formato | null>(null)

  const handleDownloadReport = async (format: Formato) => {
    if (!reportStartDate || !reportEndDate) {
      alert("Por favor selecciona ambas fechas")
      return
    }

    setDescargando(format)
    const error = await descargarArchivo(
      `/api/pagos/reporte?start_date=${reportStartDate}&end_date=${reportEndDate}&format=${format}`,
      `reporte-cobros-${reportStartDate}-${reportEndDate}.${format}`,
    )
    setDescargando(null)
    if (error) alert(error)
  }

  const sinFechas = !reportStartDate || !reportEndDate

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generar Reporte de Cobros</CardTitle>
        <CardDescription>Exporta los cobros de un rango de fechas a Excel, PDF o CSV</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start-date">Fecha de Inicio</Label>
            <Input
              id="start-date"
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">Fecha de Fin</Label>
            <Input id="end-date" type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button onClick={() => handleDownloadReport("xlsx")} disabled={sinFechas || descargando !== null}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {descargando === "xlsx" ? "Generando…" : "Excel"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownloadReport("pdf")}
            disabled={sinFechas || descargando !== null}
          >
            <FileText className="mr-2 h-4 w-4" />
            {descargando === "pdf" ? "Generando…" : "PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownloadReport("csv")}
            disabled={sinFechas || descargando !== null}
          >
            <Download className="mr-2 h-4 w-4" />
            {descargando === "csv" ? "Generando…" : "CSV"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
