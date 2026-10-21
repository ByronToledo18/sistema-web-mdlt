"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Loader2, Truck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PRODUCTOS_SERVIENTREGA, type CiudadServientrega } from "@/lib/servientrega"
import {
  formularioGuiaServientregaAction,
  generarGuiaServientregaAction,
} from "@/app/(admin)/admin/envios/actions"
import { CiudadServientregaCombobox } from "./ciudad-servientrega-combobox"

interface Formulario {
  ciudad_destino_id: number | null
  destinatario_identificacion: string
  destinatario_nombre: string
  destinatario_direccion: string
  destinatario_telefono: string
  peso_kg: string
  piezas: string
  contenido: string
  valor_mercancia: string
  producto_id: string
}

export function GenerarGuiaServientregaDialog({ envioId }: { envioId: number }) {
  const [open, setOpen] = useState(false)
  const [ciudades, setCiudades] = useState<CiudadServientrega[] | null>(null)
  const [ciudadPedido, setCiudadPedido] = useState<string | null>(null)
  const [form, setForm] = useState<Formulario | null>(null)
  const [error, setError] = useState("")
  const [cargando, startCarga] = useTransition()
  const [enviando, startEnvio] = useTransition()

  const cargar = () => {
    setError("")
    setForm(null)
    startCarga(async () => {
      const result = await formularioGuiaServientregaAction({ envio_id: envioId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const d = result.data
      setCiudades(d.ciudades)
      setCiudadPedido(d.ciudad_pedido)
      setForm({
        ciudad_destino_id: d.ciudad_sugerida_id,
        destinatario_identificacion: d.destinatario.identificacion,
        destinatario_nombre: d.destinatario.nombre,
        destinatario_direccion: d.destinatario.direccion,
        destinatario_telefono: d.destinatario.telefono,
        peso_kg: String(d.peso_kg),
        piezas: String(d.piezas),
        contenido: d.contenido,
        valor_mercancia: d.valor_mercancia.toFixed(2),
        producto_id: String(d.producto_id),
      })
    })
  }

  const set = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setError("")
    if (!form.ciudad_destino_id) {
      setError("Elige la ciudad de destino")
      return
    }
    startEnvio(async () => {
      const result = await generarGuiaServientregaAction({ envio_id: envioId, ...form })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  const campo = (id: keyof Formulario, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={`sv-${id}-${envioId}`}>{label}</Label>
      <Input
        id={`sv-${id}-${envioId}`}
        value={String(form?.[id] ?? "")}
        onChange={(e) => set(id, e.target.value as never)}
        required
        {...props}
      />
    </div>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) cargar()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Truck className="mr-2 h-4 w-4" />
          Generar guía Servientrega
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Generar guía Servientrega</DialogTitle>
            <DialogDescription>
              Se registra la guía en Servientrega con estos datos. Revisa la ciudad y el destinatario antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {cargando && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando ciudades de Servientrega…
              </p>
            )}

            {form && ciudades && (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`sv-ciudad-${envioId}`}>Ciudad de destino *</Label>
                  {ciudadPedido && (
                    <p className="text-xs text-muted-foreground">Ciudad del pedido: {ciudadPedido}</p>
                  )}
                  <CiudadServientregaCombobox
                    id={`sv-ciudad-${envioId}`}
                    ciudades={ciudades}
                    value={form.ciudad_destino_id}
                    onChange={(id) => set("ciudad_destino_id", id)}
                  />
                </div>

                {campo("destinatario_nombre", "Destinatario *", { maxLength: 150 })}
                {campo("destinatario_identificacion", "Cédula / RUC *", { maxLength: 20 })}
                {campo("destinatario_direccion", "Dirección *", { maxLength: 200 })}
                {campo("destinatario_telefono", "Teléfono *", { maxLength: 20 })}

                <div className="grid grid-cols-2 gap-4">
                  {campo("peso_kg", "Peso (kg) *", { type: "number", step: "0.01", min: "0.01" })}
                  {campo("piezas", "Piezas *", { type: "number", step: "1", min: "1" })}
                </div>
                {campo("contenido", "Contenido *", { maxLength: 100 })}
                {campo("valor_mercancia", "Valor mercancía ($) *", { type: "number", step: "0.01", min: "0" })}

                <div className="space-y-2">
                  <Label>Producto *</Label>
                  <Select value={form.producto_id} onValueChange={(v) => set("producto_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Producto de Servientrega" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTOS_SERVIENTREGA.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.id} - {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            {!form && !cargando && error ? (
              <Button type="button" variant="outline" onClick={cargar}>
                Reintentar
              </Button>
            ) : (
              <Button type="submit" disabled={!form || enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generar guía
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
