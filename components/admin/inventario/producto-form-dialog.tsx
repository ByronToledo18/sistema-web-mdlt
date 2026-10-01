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
import { IVA_PORCENTAJE } from "@/lib/iva"
import { guardarProductoAction } from "@/app/(admin)/admin/inventario/actions"
import { ImageUploadField } from "./image-upload-field"
import type { Producto } from "./types"

interface ProductoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // null = producto nuevo.
  producto: Producto | null
}

function formDe(producto: Producto | null) {
  return {
    sku: producto?.sku ?? "",
    nombre: producto?.nombre ?? "",
    precio: producto?.precio ?? "",
    stock: producto ? String(producto.stock ?? 0) : "",
    activo: producto?.activo ?? true,
    graba_iva: producto?.graba_iva ?? true,
    imagen_url: producto?.imagen_url ?? null,
  }
}

export function ProductoFormDialog({ open, onOpenChange, producto }: ProductoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* key: el formulario se reinicia cada vez que cambia el producto editado */}
        <ProductoForm key={producto?.id ?? "nuevo"} producto={producto} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ProductoForm({ producto, onDone }: { producto: Producto | null; onDone: () => void }) {
  const [form, setForm] = useState(() => formDe(producto))
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const result = await guardarProductoAction(producto?.id ?? null, form)
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
        <DialogTitle>{producto ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
        <DialogDescription>
          {producto ? "Actualiza la información del producto" : "Ingresa los datos del nuevo producto"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ImageUploadField
          id="image-upload"
          label="Imagen del Producto"
          value={form.imagen_url}
          onChange={(imagen_url) => setForm({ ...form, imagen_url })}
          onError={setError}
        />

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="TUTU-001"
            disabled={!!producto}
          />
          {producto && (
            <p className="text-xs text-muted-foreground">El SKU no puede ser modificado después de la creación</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="precio">Precio *</Label>
            <Input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock">Stock</Label>
            <Input
              id="stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="activo" checked={form.activo} onCheckedChange={(activo) => setForm({ ...form, activo })} />
          <Label htmlFor="activo">Producto activo</Label>
        </div>

        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Switch
              id="graba-iva-producto"
              checked={form.graba_iva}
              onCheckedChange={(graba_iva) => setForm({ ...form, graba_iva })}
            />
            <Label htmlFor="graba-iva-producto">Grava IVA</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            El precio no incluye IVA. Si grava, el pedido le suma el {IVA_PORCENTAJE} %.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {producto ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  )
}
