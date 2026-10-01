"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { guardarServicioAction } from "@/app/(admin)/admin/inventario/actions"
import { ImageUploadField } from "./image-upload-field"
import type { Servicio } from "./types"

interface ServicioFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // null = servicio nuevo.
  servicio: Servicio | null
}

function formDe(servicio: Servicio | null) {
  return {
    nombre: servicio?.nombre ?? "",
    unidad: servicio?.unidad ?? "",
    precio_base: servicio?.precio_base ?? "",
    variable: servicio?.variable ?? false,
    activo: servicio?.activo ?? true,
    imagen_url: servicio?.imagen_url ?? null,
  }
}

export function ServicioFormDialog({ open, onOpenChange, servicio }: ServicioFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* key: el formulario se reinicia cada vez que cambia el servicio editado */}
        <ServicioForm key={servicio?.id ?? "nuevo"} servicio={servicio} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ServicioForm({ servicio, onDone }: { servicio: Servicio | null; onDone: () => void }) {
  const [form, setForm] = useState(() => formDe(servicio))
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const result = await guardarServicioAction(servicio?.id ?? null, form)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onDone()
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{servicio ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
        <DialogDescription>
          {servicio ? "Actualiza la información del servicio" : "Ingresa los datos del nuevo servicio"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ImageUploadField
          id="image-upload-servicio"
          label="Imagen del Servicio"
          value={form.imagen_url}
          onChange={(imagen_url) => setForm({ ...form, imagen_url })}
          onError={setError}
        />

        <div className="space-y-2">
          <Label htmlFor="nombre-servicio">Nombre *</Label>
          <Input
            id="nombre-servicio"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="unidad">Unidad</Label>
            <Input
              id="unidad"
              value={form.unidad}
              onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              placeholder="hora, unidad, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="precio-base">Precio Base *</Label>
            <Input
              id="precio-base"
              type="number"
              step="0.01"
              min="0"
              value={form.precio_base}
              onChange={(e) => setForm({ ...form, precio_base: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="variable" checked={form.variable} onCheckedChange={(variable) => setForm({ ...form, variable })} />
          <Label htmlFor="variable">Precio variable</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="activo-servicio"
            checked={form.activo}
            onCheckedChange={(activo) => setForm({ ...form, activo })}
          />
          <Label htmlFor="activo-servicio">Servicio activo</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {servicio ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  )
}
