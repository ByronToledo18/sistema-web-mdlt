"use client"

import { useMemo, useState } from "react"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { normalizarTexto, type CiudadServientrega } from "@/lib/servientrega"
import { cn } from "@/lib/utils"

const MAX_RESULTADOS = 50

// Combobox simple (input de búsqueda + lista) sobre las ~600 ciudades de
// Servientrega. La búsqueda ignora tildes y mayúsculas.
export function CiudadServientregaCombobox({
  id,
  ciudades,
  value,
  onChange,
}: {
  id: string
  ciudades: CiudadServientrega[]
  value: number | null
  onChange: (id: number) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const seleccionada = ciudades.find((c) => c.id === value) ?? null

  const resultados = useMemo(() => {
    const q = normalizarTexto(busqueda)
    const filtradas = q ? ciudades.filter((c) => normalizarTexto(c.nombre).includes(q)) : ciudades
    return filtradas.slice(0, MAX_RESULTADOS)
  }, [busqueda, ciudades])

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {seleccionada ? (
          <>
            Seleccionada: <span className="font-medium">{seleccionada.nombre}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Ninguna ciudad seleccionada</span>
        )}
      </p>
      <Input
        id={id}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar ciudad (p. ej. Quito)"
        autoComplete="off"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-lista`}
      />
      <ul id={`${id}-lista`} role="listbox" className="max-h-40 overflow-y-auto rounded-md border text-sm">
        {resultados.length === 0 ? (
          <li className="px-3 py-2 text-muted-foreground">Sin resultados</li>
        ) : (
          resultados.map((ciudad) => (
            <li key={ciudad.id} role="option" aria-selected={ciudad.id === value}>
              <button
                type="button"
                onClick={() => onChange(ciudad.id)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent",
                  ciudad.id === value && "bg-accent font-medium",
                )}
              >
                {ciudad.nombre}
                {ciudad.id === value && <Check className="h-4 w-4" />}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
