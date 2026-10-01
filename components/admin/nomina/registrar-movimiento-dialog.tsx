"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
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
import { registrarMovimientoAction } from "@/app/(admin)/admin/nomina/actions"

type TipoMovimiento = "pago" | "deduccion" | "bono"

function emptyForm() {
  return {
    persona_tipo: "",
    persona_nombre: "",
    concepto: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    tipo: "pago" as TipoMovimiento,
  }
}

export function RegistrarMovimientoDialog() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const resetForm = () => {
    setForm(emptyForm())
    setError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.persona_tipo || !form.persona_nombre || !form.concepto || !form.monto) {
      setError("Todos los campos son requeridos")
      return
    }

    startTransition(async () => {
      const result = await registrarMovimientoAction({
        persona_tipo: form.persona_tipo,
        concepto: `${form.persona_nombre}: ${form.concepto}`,
        monto: form.monto,
        fecha: form.fecha,
        tipo: form.tipo,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDialogOpen(false)
      resetForm()
    })
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Movimiento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento de Nómina</DialogTitle>
            <DialogDescription>Pago, bono o deducción a una persona</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="persona-tipo">Persona *</Label>
                <Select
                  value={form.persona_tipo}
                  onValueChange={(value) => setForm({ ...form, persona_tipo: value })}
                >
                  <SelectTrigger id="persona-tipo">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emprendedora">Emprendedora</SelectItem>
                    <SelectItem value="madre">Madre de la Emprendedora</SelectItem>
                    <SelectItem value="costurera_externa">Costurera Externa</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(value) => setForm({ ...form, tipo: value as TipoMovimiento })}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="bono">Bono</SelectItem>
                    <SelectItem value="deduccion">Deducción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-nombre">Nombre de la Persona *</Label>
              <Input
                id="persona-nombre"
                value={form.persona_nombre}
                onChange={(e) => setForm({ ...form, persona_nombre: e.target.value })}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Ej: Confección de 3 tutús, semana del 24 al 28"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monto">Monto *</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
