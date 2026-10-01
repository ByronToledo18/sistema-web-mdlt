"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useDebouncedSearch, useUrlFilters } from "@/components/admin/use-url-filters"

interface ListFiltersProps {
  placeholder: string
  // Switch opcional que escribe `param=1` en la URL (p. ej. "Mostrar inactivos").
  toggle?: { id: string; param: string; label: string }
}

// Búsqueda (?q=) y switch de los listados del admin.
export function ListFilters({ placeholder, toggle }: ListFiltersProps) {
  const search = useDebouncedSearch()
  const { searchParams, setFilters } = useUrlFilters()
  // Estado local para que el switch responda al instante; la URL se
  // actualiza al terminar la transición.
  const [checked, setChecked] = useState(toggle ? searchParams.get(toggle.param) === "1" : false)

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search.value}
          onChange={(e) => search.setValue(e.target.value)}
          className="pl-10"
        />
      </div>
      {toggle && (
        <div className="flex items-center gap-2">
          <Switch
            id={toggle.id}
            checked={checked}
            onCheckedChange={(next) => {
              setChecked(next)
              setFilters({ [toggle.param]: next ? "1" : null })
            }}
          />
          <Label htmlFor={toggle.id} className="cursor-pointer">
            {toggle.label}
          </Label>
        </div>
      )}
    </div>
  )
}
