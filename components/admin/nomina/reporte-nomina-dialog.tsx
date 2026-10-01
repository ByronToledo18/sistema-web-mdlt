"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { descargarArchivo } from "@/components/admin/descargar-archivo"
import { personaTipoLabels } from "./personas"

type Formato = "xlsx" | "pdf"

// Exporta los movimientos de nómina de un rango a /api/nomina/reporte. Usa el
// filtro de persona que esté activo en la página.
export function ReporteNominaDialog({ persona }: { persona?: string }) {
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [descargando, setDescargando] = useState<Formato | null>(null)

  const descargar = async (format: Formato) => {
    setDescargando(format)
    const params = new URLSearchParams({ fecha_desde: desde, fecha_hasta: hasta, format })
    if (persona && persona !== "todos") params.set("persona_tipo", persona)
    const error = await descargarArchivo(`/api/nomina/reporte?${params}`, `reporte-nomina-${desde}-${hasta}.${format}`)
    setDescargando(null)
    if (error) alert(error)
  }

  const deshabilitado = !desde || !hasta || descargando !== null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar nómina</DialogTitle>
          <DialogDescription>
            Movimientos y consolidado por persona
            {persona && persona !== "todos" ? ` de ${personaTipoLabels[persona] ?? persona}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nomina-desde">Desde</Label>
            <Input id="nomina-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nomina-hasta">Hasta</Label>
            <Input id="nomina-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => descargar("xlsx")} disabled={deshabilitado}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {descargando === "xlsx" ? "Generando…" : "Excel"}
          </Button>
          <Button variant="outline" onClick={() => descargar("pdf")} disabled={deshabilitado}>
            <FileText className="mr-2 h-4 w-4" />
            {descargando === "pdf" ? "Generando…" : "PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
