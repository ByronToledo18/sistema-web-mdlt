"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Package, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { crearFacturaProveedorAction } from "@/app/(admin)/admin/proveedores/actions"
import { formatCurrency } from "@/components/admin/format"
import { IVA_PORCENTAJE, IVA_RATE } from "@/lib/iva"

interface ProductoOpcion {
  id: number
  nombre: string
  sku: string | null
}

interface FacturaItem {
  producto_id: number | null
  descripcion: string
  cantidad: string
  precio_unitario: string
}

const emptyItem: FacturaItem = { producto_id: null, descripcion: "", cantidad: "1", precio_unitario: "0" }
const emptyForm = { numero_factura: "", fecha_emision: "", fecha_vencimiento: "", notas: "" }

export function NuevaFacturaDialog({ proveedorId, productos }: { proveedorId: number; productos: ProductoOpcion[] }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [items, setItems] = useState<FacturaItem[]>([emptyItem])
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const resetForm = () => {
    setFormData(emptyForm)
    setItems([emptyItem])
    setError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const validItems = items.filter((item) => item.descripcion && item.cantidad && item.precio_unitario)
    if (validItems.length === 0) {
      setError("Debes agregar al menos un item")
      return
    }

    startTransition(async () => {
      const result = await crearFacturaProveedorAction(proveedorId, { ...formData, items: validItems })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDialogOpen(false)
      resetForm()
    })
  }

  const updateItem = (index: number, changes: Partial<FacturaItem>) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], ...changes }
    // Al elegir un producto se autocompleta la descripción.
    if (changes.producto_id) {
      const producto = productos.find((p) => p.id === changes.producto_id)
      if (producto) newItems[index].descripcion = producto.nombre
    }
    setItems(newItems)
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number.parseFloat(item.cantidad || "0") * Number.parseFloat(item.precio_unitario || "0"),
    0,
  )
  const iva = subtotal * IVA_RATE
  const total = subtotal + iva

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
          Nueva Factura
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Factura</DialogTitle>
            <DialogDescription>Registra una nueva factura del proveedor</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_factura">Número de Factura *</Label>
                <Input
                  id="numero_factura"
                  value={formData.numero_factura}
                  onChange={(e) => setFormData({ ...formData, numero_factura: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_emision">Fecha de Emisión *</Label>
                <Input
                  id="fecha_emision"
                  type="date"
                  value={formData.fecha_emision}
                  onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
                <Input
                  id="fecha_vencimiento"
                  type="date"
                  value={formData.fecha_vencimiento}
                  onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items de la Factura</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, emptyItem])}>
                  <Plus className="mr-2 h-3 w-3" />
                  Agregar Item
                </Button>
              </div>

              {items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Producto (opcional)</Label>
                          <Select
                            value={item.producto_id?.toString() || "0"}
                            onValueChange={(value) => updateItem(index, { producto_id: Number(value) || null })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sin producto</SelectItem>
                              {productos.map((producto) => (
                                <SelectItem key={producto.id} value={producto.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    {producto.nombre} {producto.sku && `(${producto.sku})`}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Descripción *</Label>
                          <Input
                            value={item.descripcion}
                            onChange={(e) => updateItem(index, { descripcion: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-2">
                          <Label>Cantidad *</Label>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => updateItem(index, { cantidad: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Precio Unitario *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.precio_unitario}
                            onChange={(e) => updateItem(index, { precio_unitario: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Subtotal</Label>
                          <Input
                            value={formatCurrency(
                              Number.parseFloat(item.cantidad) * Number.parseFloat(item.precio_unitario),
                            )}
                            disabled
                          />
                        </div>
                      </div>

                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setItems(items.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA ({IVA_PORCENTAJE}%):</span>
                    <span className="font-medium">{formatCurrency(iva)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              Crear Factura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
