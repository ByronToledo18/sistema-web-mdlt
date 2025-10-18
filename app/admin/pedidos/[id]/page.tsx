"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { sql } from "@vercel/postgres"
import type { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"

interface Pedido {
  id: number
  codigo: string
  cliente_id: number
  cliente_nombre: string
  cliente_telefono: string | null
  cliente_email: string | null
  cliente_direccion: string | null
  cliente_cedula: string | null // Added cliente_cedula field to interface
  estado: string
  total: string
  fecha_creacion: string
  notas: string | null // Added notas field to interface
  items: PedidoItem[]
}

interface PedidoItem {
  id: number
  item_tipo: string
  item_id: number
  descripcion: string | null
  cantidad: string
  precio_unitario: string
  subtotal: string
}

interface Producto {
  id: number
  nombre: string
  precio: string
  stock: string // Added stock field to interface
}

interface Servicio {
  id: number
  nombre: string
  precio_base: string
  variable: boolean
}

interface Pago {
  id: number
  monto: string
  metodo: string | null
  referencia: string | null
  fecha: string
  observacion: string | null
}

interface Envio {
  id: number
  guia: string
  fecha_envio: string
  estado: string
  costo: string
}

const estadoColors: Record<string, string> = {
  recibido: "bg-blue-500",
  en_proceso: "bg-yellow-500",
  terminado: "bg-green-500",
  anulado: "bg-red-500",
  entregado: "bg-purple-500",
}

const estadoLabels: Record<string, string> = {
  recibido: "Recibido",
  en_proceso: "En Proceso",
  terminado: "Terminado",
  anulado: "Anulado",
  entregado: "Entregado",
}

const estadoEnvioColors: Record<string, string> = {
  pendiente: "bg-yellow-500",
  en_proceso: "bg-blue-500",
  terminado: "bg-green-500",
}

const estadoEnvioLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  terminado: "Terminado",
}

export default function PedidoDetallePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingEstado, setUpdatingEstado] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [envioDialogOpen, setEnvioDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PedidoItem | null>(null)
  const [error, setError] = useState("")
  const [pagoError, setPagoError] = useState("")
  const [envioError, setEnvioError] = useState("")
  const [userRole, setUserRole] = useState<string>("")
  const [totalPagado, setTotalPagado] = useState<number>(0)
  const [updatingEnvioEstado, setUpdatingEnvioEstado] = useState<number | null>(null)

  const [itemForm, setItemForm] = useState({
    item_tipo: "producto",
    item_id: "",
    descripcion: "",
    cantidad: "1",
    precio_unitario: "",
  })

  const [pagoForm, setPagoForm] = useState({
    monto: "",
    metodo: "",
    referencia: "",
    observacion: "",
  })

  const [envioForm, setEnvioForm] = useState({
    costo: "",
  })

  useEffect(() => {
    fetchPedido()
    fetchProductosServicios()
    fetchPagos()
    fetchEnvios()
    fetchUserRole()
  }, [params.id])

  const fetchPedido = async () => {
    try {
      const response = await fetch(`/api/pedidos/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setPedido(data.pedido)
      } else {
        router.push("/admin/pedidos")
      }
    } catch (err) {
      console.error("[v0] Error fetching pedido:", err)
      router.push("/admin/pedidos")
    } finally {
      setLoading(false)
    }
  }

  const fetchProductosServicios = async () => {
    try {
      const [productosRes, serviciosRes] = await Promise.all([
        fetch("/api/productos?activo=true"),
        fetch("/api/servicios?activo=true"),
      ])

      const productosData = await productosRes.json()
      const serviciosData = await serviciosRes.json()

      if (productosRes.ok) setProductos(productosData.productos)
      if (serviciosRes.ok) setServicios(serviciosData.servicios)
    } catch (err) {
      console.error("[v0] Error fetching productos/servicios:", err)
    }
  }

  const fetchPagos = async () => {
    try {
      const response = await fetch(`/api/pagos?pedido_id=${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setPagos(data.pagos)
        const pagado = data.pagos.reduce((sum, pago) => sum + Number.parseFloat(pago.monto || "0"), 0)
        setTotalPagado(pagado)
      }
    } catch (err) {
      console.error("[v0] Error fetching pagos:", err)
    }
  }

  const fetchEnvios = async () => {
    try {
      const response = await fetch(`/api/envios?pedido_id=${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setEnvios(data.envios)
      }
    } catch (err) {
      console.error("[v0] Error fetching envios:", err)
    }
  }

  const fetchUserRole = async () => {
    try {
      const response = await fetch("/api/auth/me")
      const data = await response.json()
      if (response.ok && data.user) {
        setUserRole(data.user.rol)
      }
    } catch (err) {
      console.error("[v0] Error fetching user role:", err)
    }
  }

  const handleEstadoChange = async (nuevoEstado: string) => {
    if (!pedido) return

    if (nuevoEstado === "terminado" && saldoPendiente > 0) {
      alert("No se puede marcar el pedido como terminado mientras existan valores pendientes por cancelar.")
      return
    }

    setUpdatingEstado(true)
    try {
      const response = await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      if (response.ok) {
        fetchPedido()
      }
    } catch (err) {
      console.error("[v0] Error updating estado:", err)
    } finally {
      setUpdatingEstado(false)
    }
  }

  const handleItemTypeChange = (tipo: string) => {
    setItemForm({ ...itemForm, item_tipo: tipo, item_id: "", precio_unitario: "" })
  }

  const handleItemSelect = (itemId: string) => {
    const items = itemForm.item_tipo === "producto" ? productos : servicios
    const selectedItem = items.find((item) => item.id.toString() === itemId)

    if (selectedItem) {
      const precio = "precio" in selectedItem ? selectedItem.precio : selectedItem.precio_base
      setItemForm({
        ...itemForm,
        item_id: itemId,
        precio_unitario: precio,
        descripcion: selectedItem.nombre,
      })
    }
  }

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!itemForm.item_id || !itemForm.cantidad || !itemForm.precio_unitario) {
      setError("Todos los campos son requeridos")
      return
    }

    if (itemForm.item_tipo === "producto" && !editingItem) {
      const producto = productos.find((p) => p.id.toString() === itemForm.item_id)
      if (producto && Number.parseInt(producto.stock) === 0) {
        setError("No hay stock disponible para este producto")
        return
      }
    }

    try {
      console.log("[v0] Submitting item:", {
        pedidoId: params.id,
        itemForm,
        editingItem: editingItem?.id,
      })

      const url = editingItem ? `/api/pedidos/${params.id}/items/${editingItem.id}` : `/api/pedidos/${params.id}/items`
      const method = editingItem ? "PUT" : "POST"

      const body = {
        ...itemForm,
        item_id: Number.parseInt(itemForm.item_id),
        cantidad: Number.parseInt(itemForm.cantidad),
        precio_unitario: Number.parseFloat(itemForm.precio_unitario),
      }

      console.log("[v0] Request details:", { url, method, body })

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      console.log("[v0] Response status:", response.status, response.statusText)

      const data = await response.json()
      console.log("[v0] Response data:", data)

      if (!response.ok) {
        console.error("[v0] Item save failed:", data)
        setError(data.error || `Error ${response.status}: ${response.statusText}`)
        return
      }

      setDialogOpen(false)
      resetItemForm()
      fetchPedido()
      fetchProductosServicios() // Refresh products to update stock
    } catch (err) {
      console.error("[v0] Exception saving item:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido al guardar item"
      setError(`Error al guardar item: ${errorMessage}`)
    }
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

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("¿Estás seguro de eliminar este item?")) return

    try {
      const response = await fetch(`/api/pedidos/${params.id}/items/${itemId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchPedido()
      }
    } catch (err) {
      console.error("[v0] Error deleting item:", err)
    }
  }

  const handleSubmitPago = async (e: React.FormEvent) => {
    e.preventDefault()
    setPagoError("")

    if (!pagoForm.monto) {
      setPagoError("El monto es requerido")
      return
    }

    try {
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: Number.parseInt(params.id),
          monto: Number.parseFloat(pagoForm.monto),
          metodo: pagoForm.metodo || null,
          referencia: pagoForm.referencia || null,
          observacion: pagoForm.observacion || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setPagoError(data.error)
        return
      }

      setPagoDialogOpen(false)
      resetPagoForm()
      fetchPedido()
      fetchPagos()
      fetchEnvios()
    } catch (err) {
      setPagoError("Error al registrar pago")
    }
  }

  const handleDeletePago = async (pagoId: number) => {
    if (!confirm("¿Estás seguro de eliminar este pago?")) return

    try {
      const response = await fetch(`/api/pagos/${pagoId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchPedido()
        fetchPagos()
      }
    } catch (err) {
      console.error("[v0] Error deleting pago:", err)
      alert("Error al eliminar pago")
    }
  }

  const handleSubmitEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnvioError("")

    if (!envioForm.costo) {
      setEnvioError("El costo es requerido")
      return
    }

    try {
      const response = await fetch("/api/envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: Number.parseInt(params.id),
          costo: Number.parseFloat(envioForm.costo),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setEnvioError(data.error)
        return
      }

      setEnvioDialogOpen(false)
      resetEnvioForm()
      fetchEnvios()
    } catch (err) {
      setEnvioError("Error al crear envío")
    }
  }

  const handleDeleteEnvio = async (envioId: number) => {
    if (!confirm("¿Estás seguro de eliminar este envío?")) return

    try {
      const response = await fetch(`/api/envios/${envioId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Error al eliminar envío")
        return
      }

      fetchEnvios()
    } catch (err) {
      console.error("[v0] Error deleting envio:", err)
      alert("Error al eliminar envío")
    }
  }

  const handleEnvioEstadoChange = async (envioId: number, nuevoEstado: string) => {
    setUpdatingEnvioEstado(envioId)
    try {
      const response = await fetch(`/api/envios/${envioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      if (response.ok) {
        fetchEnvios()
      } else {
        const data = await response.json()
        alert(data.error || "Error al actualizar estado del envío")
      }
    } catch (err) {
      console.error("[v0] Error updating envio estado:", err)
      alert("Error al actualizar estado del envío")
    } finally {
      setUpdatingEnvioEstado(null)
    }
  }

  const resetItemForm = () => {
    setItemForm({
      item_tipo: "producto",
      item_id: "",
      descripcion: "",
      cantidad: "1",
      precio_unitario: "",
    })
    setEditingItem(null)
    setError("")
  }

  const resetPagoForm = () => {
    setPagoForm({
      monto: "",
      metodo: "",
      referencia: "",
      observacion: "",
    })
    setPagoError("")
  }

  const resetEnvioForm = () => {
    setEnvioForm({
      costo: "",
    })
    setEnvioError("")
  }

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(Number.parseFloat(value))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-EC", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const canDeleteEnvio = userRole === "administrador"
  const isOrderClosed =
    pedido && (pedido.estado === "terminado" || pedido.estado === "anulado" || pedido.estado === "entregado")
  const canModifyOrder = userRole === "administrador" || !isOrderClosed

  let saldoPendiente = 0
  let canCreateShipping = false

  if (pedido) {
    saldoPendiente = Number.parseFloat(pedido.total) - totalPagado
    canCreateShipping = saldoPendiente <= 0 && canModifyOrder
  }

  const currentItems = itemForm.item_tipo === "producto" ? productos : servicios

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12">Cargando pedido...</div>
        </div>
      </div>
    )
  }

  if (!pedido) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <BackButton href="/admin/pedidos" label="Volver a Pedidos" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{pedido.codigo}</h1>
            <p className="text-muted-foreground">Detalle del pedido</p>
          </div>
          <Badge className={estadoColors[pedido.estado]} style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}>
            {estadoLabels[pedido.estado]}
          </Badge>
        </div>

        {isOrderClosed && userRole === "asistente" && (
          <Alert>
            <AlertDescription>
              Este pedido está{" "}
              <strong>
                {pedido.estado === "terminado" ? "terminado" : pedido.estado === "anulado" ? "anulado" : "entregado"}
              </strong>{" "}
              y no permite modificaciones. Solo los administradores pueden realizar cambios en pedidos cerrados.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{pedido.cliente_nombre}</p>
              </div>
              {pedido.cliente_cedula && (
                <div>
                  <p className="text-sm text-muted-foreground">Cédula</p>
                  <p className="font-medium">{pedido.cliente_cedula}</p>
                </div>
              )}
              {pedido.cliente_telefono && (
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{pedido.cliente_telefono}</p>
                </div>
              )}
              {pedido.cliente_email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{pedido.cliente_email}</p>
                </div>
              )}
              {pedido.cliente_direccion && (
                <div>
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{pedido.cliente_direccion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información del Pedido</CardTitle>
                </div>
                <Select
                  value={pedido.estado}
                  onValueChange={handleEstadoChange}
                  disabled={updatingEstado || !canModifyOrder}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recibido">Recibido</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="terminado">Terminado</SelectItem>
                    <SelectItem value="anulado">Anulado</SelectItem>
                    <SelectItem value="entregado">Entregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                <p className="font-medium">{formatDate(pedido.fecha_creacion)}</p>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Total del Pedido</p>
                  <p className="text-2xl font-bold">{formatCurrency(pedido.total)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Pagado</p>
                  <p className="text-lg font-medium text-green-600">{formatCurrency(totalPagado.toString())}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <p className="text-sm font-medium">Saldo Pendiente</p>
                  <p className={`text-xl font-bold ${saldoPendiente > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {formatCurrency(saldoPendiente.toString())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {pedido.notas && (
          <Alert>
            <AlertDescription>
              <p className="font-medium mb-1">Notas del Pedido:</p>
              <p className="whitespace-pre-wrap">{pedido.notas}</p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Items del Pedido</CardTitle>
                <CardDescription>
                  {pedido.items.length === 0 ? "No hay items agregados" : `${pedido.items.length} item(s)`}
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
                        <Select
                          value={itemForm.item_tipo}
                          onValueChange={handleItemTypeChange}
                          disabled={!!editingItem}
                        >
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
                                (
                                  Number.parseInt(itemForm.cantidad) * Number.parseFloat(itemForm.precio_unitario)
                                ).toString(),
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button type="submit">{editingItem ? "Actualizar" : "Agregar"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {pedido.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Este pedido aún no tiene items.</p>
                <p className="text-sm mt-2">Haz clic en "Agregar Item" para comenzar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pedido.items.map((item) => {
                  const isShippingItem =
                    item.descripcion?.toLowerCase().includes("envío") ||
                    item.descripcion?.toLowerCase().includes("envio")

                  return (
                    <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{item.descripcion || `Item ${item.id}`}</p>
                          <Badge variant="outline" className="text-xs">
                            {item.item_tipo}
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
                          disabled={!canModifyOrder}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={!canModifyOrder}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pagos Recibidos</CardTitle>
                <CardDescription>
                  {pagos.length === 0 ? "No hay pagos registrados" : `${pagos.length} pago(s) registrado(s)`}
                </CardDescription>
              </div>
              <Dialog
                open={pagoDialogOpen}
                onOpenChange={(open) => {
                  setPagoDialogOpen(open)
                  if (!open) resetPagoForm()
                }}
              >
                <DialogTrigger asChild>
                  <Button disabled={saldoPendiente <= 0 || !canModifyOrder}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Registrar Pago
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <form onSubmit={handleSubmitPago}>
                    <DialogHeader>
                      <DialogTitle>Registrar Pago</DialogTitle>
                      <DialogDescription>
                        Registra un pago recibido para este pedido. Saldo pendiente:{" "}
                        {formatCurrency(saldoPendiente.toString())}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      {pagoError && (
                        <Alert variant="destructive">
                          <AlertDescription>{pagoError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="monto">Monto *</Label>
                        <Input
                          id="monto"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={saldoPendiente}
                          value={pagoForm.monto}
                          onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Máximo: {formatCurrency(saldoPendiente.toString())}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="metodo">Método de Pago</Label>
                        <Select
                          value={pagoForm.metodo}
                          onValueChange={(value) => setPagoForm({ ...pagoForm, metodo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un método" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="efectivo">Efectivo</SelectItem>
                            <SelectItem value="transferencia">Transferencia</SelectItem>
                            <SelectItem value="tarjeta">Tarjeta</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="referencia">Referencia</Label>
                        <Input
                          id="referencia"
                          value={pagoForm.referencia}
                          onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                          placeholder="Número de transacción, etc."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="observacion">Observación</Label>
                        <Textarea
                          id="observacion"
                          value={pagoForm.observacion}
                          onChange={(e) => setPagoForm({ ...pagoForm, observacion: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="submit">Registrar Pago</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {pagos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay pagos registrados para este pedido.</p>
                <p className="text-sm mt-2">Haz clic en "Registrar Pago" para agregar uno.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagos.map((pago) => (
                  <div key={pago.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-lg text-green-600">{formatCurrency(pago.monto)}</p>
                        {pago.metodo && <Badge variant="outline">{pago.metodo}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(pago.fecha)}
                        {pago.referencia && ` • Ref: ${pago.referencia}`}
                      </p>
                      {pago.observacion && <p className="text-sm mt-1 italic">{pago.observacion}</p>}
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeletePago(pago.id)}
                      disabled={!canModifyOrder}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Envíos</CardTitle>
                <CardDescription>
                  {envios.length === 0 ? "No hay envíos registrados" : `${envios.length} envío(s) registrado(s)`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {envios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay envíos registrados para este pedido.</p>
                <p className="text-sm mt-2">
                  Agrega el servicio de "Envío" como item para registrar el costo de envío.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {envios.map((envio) => (
                  <div key={envio.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-lg">{envio.guia}</p>
                        <Badge className={estadoEnvioColors[envio.estado]}>{estadoEnvioLabels[envio.estado]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(envio.fecha_envio)}</p>
                      <p className="text-sm">
                        <span className="font-medium">Costo:</span> {formatCurrency(envio.costo)}
                      </p>
                      {envio.estado === "terminado" && (
                        <Alert>
                          <AlertDescription className="text-xs">
                            Este envío ha sido agregado a la cuenta de Servientrega
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    {canDeleteEnvio && (
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteEnvio(envio.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
    const { id } = params

    const pedidoResult = await sql`
      SELECT p.id, p.codigo, p.cliente_id, p.estado, p.fecha_creacion, p.total, p.notas,
             p.created_at, p.updated_at,
             c.nombre as cliente_nombre, c.cedula as cliente_cedula, c.telefono as cliente_telefono, 
             c.email as cliente_email, c.direccion as cliente_direccion
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ${id}
    `

    // <rest of code here>
  } catch (err) {
    console.error("[v0] Error fetching pedido:", err)
    return new Response("Error fetching pedido", { status: 500 })
  }
}
