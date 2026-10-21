"use client"

import { useState, useTransition } from "react"
import { Ban, Download, Tag, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { descargarArchivo } from "@/components/admin/descargar-archivo"
import { anularGuiaServientregaAction } from "@/app/(admin)/admin/envios/actions"
import { GenerarGuiaServientregaDialog } from "./generar-guia-servientrega-dialog"

export interface EnvioServientrega {
  id: number
  guia_servientrega: string | null
  servientrega_estado: string | null
}

export interface IntegracionServientrega {
  habilitada: boolean
  motivo?: string
}

// Botones de la guía de Servientrega de un envío (tarjeta del pedido y lista
// de Envíos): generar, descargar guía A4 y rótulo, y anular.
export function GuiaServientregaAcciones({
  envio,
  integracion,
  canUpdate,
}: {
  envio: EnvioServientrega
  integracion: IntegracionServientrega
  canUpdate: boolean
}) {
  const [error, setError] = useState("")
  const [descargando, setDescargando] = useState<"a4" | "rotulo" | null>(null)
  const [anulando, startAnular] = useTransition()

  const vigente = envio.servientrega_estado === "generada" && envio.guia_servientrega
  const numero = envio.guia_servientrega

  const descargar = async (tipo: "a4" | "rotulo") => {
    setError("")
    setDescargando(tipo)
    const nombre = `${tipo === "a4" ? "guia" : "rotulo"}-servientrega-${numero}.pdf`
    const fallo = await descargarArchivo(`/api/envios/${envio.id}/guia-servientrega?tipo=${tipo}`, nombre)
    setDescargando(null)
    if (fallo) setError(fallo)
  }

  const anular = () => {
    if (!confirm(`¿Anular la guía de Servientrega ${numero}? Esta acción no se puede deshacer.`)) return
    setError("")
    startAnular(async () => {
      const result = await anularGuiaServientregaAction({ envio_id: envio.id })
      if (!result.ok) setError(result.error)
    })
  }

  if (vigente) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Truck className="h-3 w-3" />
            Servientrega {numero}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => descargar("a4")} disabled={descargando !== null || !integracion.habilitada}>
            <Download className="mr-2 h-4 w-4" />
            Descargar guía (PDF)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => descargar("rotulo")}
            disabled={descargando !== null || !integracion.habilitada}
          >
            <Tag className="mr-2 h-4 w-4" />
            Rótulo
          </Button>
          {canUpdate && (
            <Button size="sm" variant="destructive" onClick={anular} disabled={anulando || !integracion.habilitada}>
              <Ban className="mr-2 h-4 w-4" />
              Anular guía
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  if (!canUpdate) return null

  return (
    <div className="space-y-1">
      {envio.servientrega_estado === "generando" ? (
        <Badge variant="outline">Generando guía Servientrega…</Badge>
      ) : integracion.habilitada ? (
        <GenerarGuiaServientregaDialog envioId={envio.id} />
      ) : (
        // Un botón deshabilitado no recibe eventos del mouse: el tooltip va en el span.
        <span title={integracion.motivo} className="inline-block cursor-not-allowed">
          <Button size="sm" disabled>
            <Truck className="mr-2 h-4 w-4" />
            Generar guía Servientrega
          </Button>
        </span>
      )}
      {envio.servientrega_estado === "anulada" && numero && (
        <p className="text-xs text-muted-foreground">Guía {numero} anulada</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
