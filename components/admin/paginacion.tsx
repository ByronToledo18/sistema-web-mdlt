"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUrlFilters } from "@/components/admin/use-url-filters"

// Anterior / Siguiente para los listados paginados del admin (?page=).
export function Paginacion({ pagina, haySiguiente }: { pagina: number; haySiguiente: boolean }) {
  const { setFilters, isPending } = useUrlFilters()
  if (pagina <= 1 && !haySiguiente) return null

  const ir = (destino: number) => setFilters({ page: destino > 1 ? String(destino) : null })

  return (
    <nav aria-label="Paginación" className="flex items-center justify-end gap-2 pt-4">
      <Button variant="outline" size="sm" onClick={() => ir(pagina - 1)} disabled={pagina <= 1 || isPending}>
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">Página {pagina}</span>
      <Button variant="outline" size="sm" onClick={() => ir(pagina + 1)} disabled={!haySiguiente || isPending}>
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}
