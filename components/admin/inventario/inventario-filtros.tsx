"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useDebouncedSearch, useUrlFilters } from "@/components/admin/use-url-filters"

export function InventarioFiltros({ canManage }: { canManage: boolean }) {
  const search = useDebouncedSearch()
  const { searchParams, setFilters } = useUrlFilters()
  // Estado local para que el switch responda al instante; la URL se
  // actualiza al terminar la transición.
  const [showInactive, setShowInactive] = useState(searchParams.get("inactivos") === "1")

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar productos o servicios..."
          value={search.value}
          onChange={(e) => search.setValue(e.target.value)}
          className="pl-10"
        />
      </div>
      {canManage && (
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={(checked) => {
              setShowInactive(checked)
              setFilters({ inactivos: checked ? "1" : null })
            }}
          />
          <Label htmlFor="show-inactive" className="cursor-pointer">
            Mostrar inactivos
          </Label>
        </div>
      )}
    </div>
  )
}
