"use client"

import { useState, useEffect } from "react"
import { MapPin, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Tarifa {
  id: number
  ciudad: string
  provincia: string
  costo: number
}

interface LocationMapProps {
  onLocationSelect: (ciudad: string, costo: number, coords?: { lat: number; lng: number }) => void
  selectedCiudad?: string
}

export function LocationMap({ onLocationSelect, selectedCiudad }: LocationMapProps) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCity, setSelectedCity] = useState(selectedCiudad || "")

  useEffect(() => {
    fetchTarifas()
  }, [])

  const fetchTarifas = async () => {
    try {
      const response = await fetch("/api/tarifas-envio")
      const data = await response.json()
      setTarifas(data.tarifas || [])
    } catch (error) {
      console.error("[v0] Error fetching tarifas:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTarifas = tarifas.filter(
    (t) =>
      (t.ciudad && t.ciudad.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.provincia && t.provincia.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleCitySelect = (ciudad: string) => {
    const tarifa = tarifas.find((t) => t.ciudad === ciudad)
    if (tarifa) {
      setSelectedCity(ciudad)
      onLocationSelect(ciudad, Number(tarifa.costo))
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Selecciona tu Ciudad
        </Label>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background text-foreground border-border"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted-foreground">Cargando ciudades...</div>
      ) : (
        <div className="space-y-2">
          <Select value={selectedCity} onValueChange={handleCitySelect}>
            <SelectTrigger className="bg-background text-foreground border-border">
              <SelectValue placeholder="Selecciona una ciudad" />
            </SelectTrigger>
            <SelectContent>
              {filteredTarifas.map((tarifa) => (
                <SelectItem key={tarifa.id} value={tarifa.ciudad}>
                  <div className="flex items-center justify-between w-full">
                    <span>
                      {tarifa.ciudad}, {tarifa.provincia}
                    </span>
                    <span className="ml-4 text-primary font-semibold">${Number(tarifa.costo).toFixed(2)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCity && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Ciudad seleccionada:</span> {selectedCity}
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Costo de envío:</span> $
                {Number(tarifas.find((t) => t.ciudad === selectedCity)?.costo || 0).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}

      {filteredTarifas.length === 0 && !loading && (
        <div className="text-center py-4 text-muted-foreground">
          No se encontraron ciudades. Contacta con nosotros para consultar el costo de envío a tu ubicación.
        </div>
      )}
    </div>
  )
}
