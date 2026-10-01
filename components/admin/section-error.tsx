"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"

// Cuerpo común de los error.tsx del admin. El mensaje real del error nunca se
// muestra (en producción Next solo manda el digest); queda en el log.
export function SectionError({
  error,
  reset,
  backHref = "/admin/dashboard",
  backLabel = "Volver al Dashboard",
}: {
  error: Error & { digest?: string }
  reset: () => void
  backHref?: string
  backLabel?: string
}) {
  useEffect(() => {
    console.error("[admin] Error al renderizar la sección:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto mt-16 rounded-lg border bg-card p-8 text-center space-y-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">No se pudo cargar esta sección</h1>
        <p className="text-sm text-muted-foreground">
          Ocurrió un error inesperado. Intenta de nuevo y, si el problema continúa, contacta a soporte.
          {error.digest && <span className="block mt-2 font-mono text-xs">Código: {error.digest}</span>}
        </p>
        <div className="flex justify-center gap-2">
          <BackButton href={backHref} label={backLabel} />
          <Button size="sm" onClick={reset}>
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  )
}
