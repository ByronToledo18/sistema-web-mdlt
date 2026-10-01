"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { agregarItemAction, editarItemAction, eliminarItemAction } from "@/app/(admin)/admin/pedidos/actions"
import { formatCurrency } from "@/components/admin/format"
import { calcularTotales, IVA_PORCENTAJE } from "@/lib/iva"
import type { PedidoItem, ProductoOpcion, ServicioOpcion } from "./types"

interface PedidoItemsCardProps {
  pedidoId: number
  items: PedidoItem[]
  productos: ProductoOpcion[]
  servicios: ServicioOpcion[]
  isOrderClosed: boolean
  canModifyOrder: boolean
}

const emptyForm = {
  item_tipo: "producto",
  item_id: "",
  descripcion: "",
  cantidad: "1",
  precio_unitario: "",
}

export function PedidoItemsCard({
  pedidoId,
  items,
  productos,
  servicios,
  isOrderClosed,
  canModifyOrder,
}: PedidoItemsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PedidoItem | null>(null)
  const [itemForm, setItemForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const currentItems: (ProductoOpcion | ServicioOpcion)[] = itemForm.item_tipo === "producto" ? productos : servicios

  // Totales del pedido en centavos, con el IVA sobre la base gravada: el
  // mismo cálculo (lib/iva.ts) que guarda pedidos.total.
  const totales = calcularTotales(
    items.map((item) => ({ subtotalCents: Math.round(Number(item.subtotal) * 100), grabaIva: !!item.graba_iva })),
  )

  const resetItemForm = () => {
    setItemForm(emptyForm)
    setEditingItem(null)
    setError("")
  }

  const handleItemTypeChange = (tipo: string) => {
    setItemForm({ ...itemForm, item_tipo: tipo, item_id: "", precio_unitario: "" })
  }

  const handleItemSelect = (itemId: string) => {
    const selectedItem = currentItems.find((item) => item.id.toString() === itemId)
    if (selectedItem) {
      const precio = "precio" in selectedItem ? selectedItem.precio : selectedItem.precio_base
      setItemForm({ ...itemForm, item_id: itemId, precio_unitario: precio, descripcion: selectedItem.nombre })
    }
  }

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!itemForm.item_id || !itemForm.cantidad || !itemForm.precio_unitario) {
      setError("Todos los campos son requeridos")
      return
    }

    if (itemForm.item_tipo === "producto" && !editingItem) {
      const producto = productos.find((p) => p.id.toString() === itemForm.item_id)
      if (producto && (producto.stock ?? 0) === 0) {
        setError("No hay stock disponible para este producto")
        return
      }
    }

    startTransition(async () => {
      const result = editingItem
        ? await editarItemAction(pedidoId, editingItem.id, {
            descripcion: itemForm.descripcion,
            cantidad: itemForm.cantidad,
            precio_unitario: itemForm.precio_unitario,
          })
        : await agregarItemAction(pedidoId, itemForm)

      if (!result.ok) {
        setError(result.error)
        return
      }
      setDialogOpen(false)
      resetItemForm()
    })
  }

  const handleEditItem = (item: PedidoItem) => {
    setEditingItem(item)
    setItemForm({
      item_tipo: item.item_tipo,
      item_id: item.item_id.toString(),
      descripcion: item.descripcion || "",
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
    })
    setDialogOpen(true)
  }

  const handleDeleteItem = (itemId: number) => {
    if (!confirm("¿Estás seguro de eliminar este item?")) return
    startTransition(async () => {
      const result = await eliminarItemAction(pedidoId, itemId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Items del Pedido</CardTitle>
            <CardDescription>
              {items.length === 0 ? "No hay items agregados" : `${items.length} item(s)`}
            </CardDescription>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetItemForm()
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={isOrderClosed}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
              <form onSubmit={handleSubmitItem}>
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Editar Item" : "Agregar Item"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "Actualiza la información del item" : "Agrega un producto o servicio al pedido"}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={itemForm.item_tipo} onValueChange={handleItemTypeChange} disabled={!!editingItem}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producto">Producto</SelectItem>
                        <SelectItem value="servicio">Servicio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{itemForm.item_tipo === "producto" ? "Producto" : "Servicio"} *</Label>
                    <Select value={itemForm.item_id} onValueChange={handleItemSelect} disabled={!!editingItem}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un item" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentItems.map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.nombre} - {formatCurrency("precio" in item ? item.precio : item.precio_base)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      value={itemForm.descripcion}
                      onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cantidad">Cantidad *</Label>
                      <Input
                        id="cantidad"
                        type="number"
                        step="1"
                        min="1"
                        value={itemForm.cantidad}
                        onChange={(e) => setItemForm({ ...itemForm, cantidad: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="precio">Precio Unitario *</Label>
                      <Input
                        id="precio"
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.precio_unitario}
                        onChange={(e) => setItemForm({ ...itemForm, precio_unitario: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {itemForm.cantidad && itemForm.precio_unitario && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Subtotal:</span>
                        <span className="text-xl font-bold">
                          {formatCurrency(
                            Number.parseInt(itemForm.cantidad) * Number.parseFloat(itemForm.precio_unitario),
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {editingItem ? "Actualizar" : "Agregar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Este pedido aún no tiene items.</p>
            <p className="text-sm mt-2">Haz clic en &quot;Agregar Item&quot; para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isShippingItem =
                item.descripcion?.toLowerCase().includes("envío") || item.descripcion?.toLowerCase().includes("envio")

              return (
                <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{item.descripcion || `Item ${item.id}`}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.item_tipo}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.graba_iva ? `IVA ${IVA_PORCENTAJE} %` : "IVA 0 %"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isShippingItem
                        ? formatCurrency(item.precio_unitario)
                        : `Cantidad: ${item.cantidad} × ${formatCurrency(item.precio_unitario)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg">{formatCurrency(item.subtotal)}</p>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditItem(item)}
                      disabled={!canModifyOrder || isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={!canModifyOrder || isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            <div className="ml-auto w-full max-w-xs space-y-1 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(totales.subtotal / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA {IVA_PORCENTAJE} %</span>
                <span>{formatCurrency(totales.iva / 100)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(totales.total / 100)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
