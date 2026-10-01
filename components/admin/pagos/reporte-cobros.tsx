"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Descarga el CSV de /api/pagos/reporte (la ruta se mantiene: devuelve un archivo).
export function ReporteCobros() {
  const [reportStartDate, setReportStartDate] = useState("")
  const [reportEndDate, setReportEndDate] = useState("")

  const handleDownloadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Por favor selecciona ambas fechas")
      return
    }

    try {
      const response = await fetch(
        `/api/pagos/reporte?start_date=${reportStartDate}&end_date=${reportEndDate}&format=csv`,
      )
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        alert(data?.error ?? "Error al descargar el reporte")
        return
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `reporte-pagos-${reportStartDate}-${reportEndDate}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      alert("Error al descargar el reporte")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generar Reporte de Cobros</CardTitle>
        <CardDescription>Exporta los cobros de un rango de fechas a CSV</CardDescription>
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

        <Button onClick={handleDownloadReport} disabled={!reportStartDate || !reportEndDate} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Descargar Reporte CSV
        </Button>
      </CardContent>
    </Card>
  )
}
