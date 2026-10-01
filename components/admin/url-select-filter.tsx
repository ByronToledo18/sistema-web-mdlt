"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUrlFilters } from "@/components/admin/use-url-filters"

interface UrlSelectFilterProps {
  param: string
  // Valor que equivale a "sin filtro" (no se escribe en la URL).
  allValue: string
  options: { value: string; label: string }[]
  className?: string
}

// Select cuyo valor vive en un parámetro de la URL.
export function UrlSelectFilter({ param, allValue, options, className }: UrlSelectFilterProps) {
  const { searchParams, setFilters } = useUrlFilters()
  const [value, setValue] = useState(searchParams.get(param) ?? allValue)

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        setValue(next)
        setFilters({ [param]: next === allValue ? null : next })
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
