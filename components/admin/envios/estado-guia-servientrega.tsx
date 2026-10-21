"use client"

import { useState, useTransition } from "react"
import { ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/components/admin/format"
import { urlRastreoPublico } from "@/lib/servientrega"
import type { TrazabilidadGuia } from "@/server/integraciones/servientrega/trazabilidad"
import { actualizarEstadoGuiaAction } from "@/app/(admin)/admin/envios/actions"

// Estado de la guía en Servientrega: el último guardado, el botón para
// consultarlo de nuevo (servicio SOAP de trazabilidad) con la línea de tiempo
// de movimientos, y el enlace público de rastreo.
export function EstadoGuiaServientrega({
  envioId,
  numero,
  estadoActual,
  consultadoAt,
  habilitada,
}: {
  envioId: number
  numero: string
  estadoActual: string | null
  consultadoAt: Date | string | null
  habilitada: boolean
}) {
  const [trazabilidad, setTrazabilidad] = useState<TrazabilidadGuia | null>(null)
  const [error, setError] = useState("")
  const [consultando, startConsulta] = useTransition()

  const actualizar = () => {
    setError("")
    startConsulta(async () => {
      const result = await actualizarEstadoGuiaAction({ envio_id: envioId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setTrazabilidad(result.data.trazabilidad)
    })
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          <span className="font-medium">Estado Servientrega:</span> {estadoActual ?? (consultadoAt ? "Sin datos en Servientrega" : "Sin consultar")}
          {consultadoAt && (
            <span className="text-xs text-muted-foreground"> (consultado {formatDateTime(consultadoAt)})</span>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={actualizar} disabled={consultando || !habilitada}>
          {consultando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualizar estado
        </Button>
        <a
          href={urlRastreoPublico(numero)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          Rastreo en Servientrega
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      {trazabilidad &&
        (trazabilidad.sinDatos ? (
          <p className="text-muted-foreground">
            Servientrega todavía no tiene movimientos para la guía {trazabilidad.numeroGuia}.
          </p>
        ) : (
          <div className="rounded-md border p-3 space-y-2">
            <p>
              <span className="font-medium">{trazabilidad.estadoActual ?? "Sin estado"}</span>
              {trazabilidad.fechaEstado && <span className="text-muted-foreground"> · {trazabilidad.fechaEstado}</span>}
            </p>
            {(trazabilidad.ciudadOrigen || trazabilidad.ciudadDestino) && (
              <p className="text-muted-foreground">
                {trazabilidad.ciudadOrigen ?? "?"} → {trazabilidad.ciudadDestino ?? "?"}
                {trazabilidad.fechaProbable && ` · entrega probable ${trazabilidad.fechaProbable}`}
              </p>
            )}
            {trazabilidad.receptor && <p>Recibió: {trazabilidad.receptor}</p>}
            {trazabilidad.movimientos.length > 0 && (
              <ol className="relative ml-2 space-y-2 border-l pl-4">
                {trazabilidad.movimientos.map((m, i) => (
                  <li key={`${m.fecha}-${i}`}>
                    <p className="font-medium">{m.nombre || m.descripcion}</p>
                    <p className="text-xs text-muted-foreground">
                      {[m.fecha, m.origen, m.descripcion !== m.nombre ? m.descripcion : ""].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
    </div>
  )
}
