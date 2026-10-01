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
import { Textarea } from "@/components/ui/textarea"
import { guardarProveedorAction } from "@/app/(admin)/admin/proveedores/actions"
import type { Proveedor } from "./types"

interface ProveedorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // null = proveedor nuevo.
  proveedor: Proveedor | null
}

export function ProveedorFormDialog({ open, onOpenChange, proveedor }: ProveedorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        {/* key: el formulario se reinicia cada vez que cambia el proveedor editado */}
        <ProveedorForm key={proveedor?.id ?? "nuevo"} proveedor={proveedor} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ProveedorForm({ proveedor, onDone }: { proveedor: Proveedor | null; onDone: () => void }) {
  const [formData, setFormData] = useState({
    nombre: proveedor?.nombre ?? "",
    ruc: proveedor?.ruc ?? "",
    telefono: proveedor?.telefono ?? "",
    email: proveedor?.email ?? "",
    direccion: proveedor?.direccion ?? "",
    contacto_nombre: proveedor?.contacto_nombre ?? "",
    contacto_telefono: proveedor?.contacto_telefono ?? "",
    notas: proveedor?.notas ?? "",
  })
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const result = await guardarProveedorAction(proveedor?.id ?? null, formData)
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
        <DialogTitle>{proveedor ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
        <DialogDescription>
          {proveedor ? "Actualiza la información del proveedor" : "Ingresa los datos del nuevo proveedor"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruc">RUC</Label>
            <Input
              id="ruc"
              value={formData.ruc}
              onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
              placeholder="1234567890001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Textarea
              id="direccion"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacto_nombre">Nombre de Contacto</Label>
            <Input
              id="contacto_nombre"
              value={formData.contacto_nombre}
              onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacto_telefono">Teléfono de Contacto</Label>
            <Input
              id="contacto_telefono"
              value={formData.contacto_telefono}
              onChange={(e) => setFormData({ ...formData, contacto_telefono: e.target.value })}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {proveedor ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  )
}
