"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MESES } from "@/components/admin/format"
import { useUrlFilters } from "@/components/admin/use-url-filters"

// Mes y año en la URL (?year=&month=). Se muestran los últimos 5 años.
export function PeriodoSelector({ year, month }: { year: number; month: number }) {
  const { setFilters } = useUrlFilters()
  const [selected, setSelected] = useState({ year, month })
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const update = (next: { year: number; month: number }) => {
    setSelected(next)
    setFilters({ year: String(next.year), month: String(next.month) })
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <Label>Mes</Label>
        <Select
          value={selected.month.toString()}
          onValueChange={(value) => update({ ...selected, month: Number.parseInt(value) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((nombre, index) => (
              <SelectItem key={index} value={(index + 1).toString()}>
                {nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        <Label>Año</Label>
        <Select
          value={selected.year.toString()}
          onValueChange={(value) => update({ ...selected, year: Number.parseInt(value) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
