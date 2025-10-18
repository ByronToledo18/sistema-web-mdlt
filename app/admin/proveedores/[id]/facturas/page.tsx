"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, FileText, DollarSign, AlertCircle, Package } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { useParams } from "next/navigation"

interface Factura {
  id: number
  numero_factura: string
  fecha_emision: string
  fecha_vencimiento: string | null
  subtotal: string
  iva: string
  total: string
  pagado: string
  saldo: string
  estado: string
  proveedor_nombre: string
}

interface Producto {
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

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-500",
  pagada: "bg-green-500",
  vencida: "bg-red-500",
  anulada: "bg-gray-500",
}

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
  anulada: "Anulada",
}

export default function ProveedorFacturasPage() {
  const params = useParams()
  const proveedorId = params.id as string

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [error, setError] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<string>("todas")

  const [formData, setFormData] = useState({
    numero_factura: "",
    fecha_emision: "",
    fecha_vencimiento: "",
    notas: "",
  })

  const [items, setItems] = useState<FacturaItem[]>([
    { producto_id: null, descripcion: "", cantidad: "1", precio_unitario: "0" },
  ])

  const [pagoData, setPagoData] = useState({
    monto: "",
    metodo: "",
    referencia: "",
    observacion: "",
  })

  useEffect(() => {
    fetchFacturas()
    fetchProductos()
  }, [estadoFilter])

  const fetchFacturas = async () => {
    try {
      const params = new URLSearchParams()
      if (estadoFilter !== "todas") params.append("estado", estadoFilter)

      const response = await fetch(`/api/proveedores/${proveedorId}/facturas?${params}`)
      const data = await response.json()

      if (response.ok) {
        setFacturas(data.facturas)
      }
    } catch (err) {
      console.error("[v0] Error fetching facturas:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProductos = async () => {
    try {
      const response = await fetch("/api/productos")
      const data = await response.json()

      if (response.ok) {
        setProductos(data.productos)
      }
    } catch (err) {
      console.error("[v0] Error fetching productos:", err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate items
    const validItems = items.filter((item) => item.descripcion && item.cantidad && item.precio_unitario)

    if (validItems.length === 0) {
      setError("Debes agregar al menos un item")
      return
    }

    try {
      const response = await fetch(`/api/proveedores/${proveedorId}/facturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          items: validItems,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setDialogOpen(false)
      resetForm()
      fetchFacturas()
    } catch (err) {
      setError("Error al crear factura")
    }
  }

  const handlePago = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!selectedFactura) return

    try {
      const response = await fetch(`/api/proveedores/facturas/${selectedFactura.id}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pagoData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setPagoDialogOpen(false)
      setSelectedFactura(null)
      resetPagoForm()
      fetchFacturas()
    } catch (err) {
      setError("Error al registrar pago")
    }
  }

  const handleAnular = async (facturaId: number) => {
    if (!confirm("¿Estás seguro de anular esta factura? Esto revertirá el stock agregado.")) return

    try {
      const response = await fetch(`/api/proveedores/facturas/${facturaId}`, { method: "DELETE" })
      const data = await response.json()

      if (response.ok) {
        fetchFacturas()
      } else {
        alert(data.error || "Error al anular factura")
      }
    } catch (err) {
      console.error("[v0] Error anulando factura:", err)
      alert("Error al anular factura")
    }
  }

  const addItem = () => {
    setItems([...items, { producto_id: null, descripcion: "", cantidad: "1", precio_unitario: "0" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof FacturaItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // If producto is selected, auto-fill descripcion
    if (field === "producto_id" && value) {
      const producto = productos.find((p) => p.id === Number(value))
      if (producto) {
        newItems[index].descripcion = producto.nombre
      }
    }

    setItems(newItems)
  }

  const resetForm = () => {
    setFormData({ numero_factura: "", fecha_emision: "", fecha_vencimiento: "", notas: "" })
    setItems([{ producto_id: null, descripcion: "", cantidad: "1", precio_unitario: "0" }])
    setError("")
  }

  const resetPagoForm = () => {
    setPagoData({ monto: "", metodo: "", referencia: "", observacion: "" })
    setError("")
  }

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(Number.parseFloat(value))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-EC", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      return sum + Number.parseFloat(item.cantidad || "0") * Number.parseFloat(item.precio_unitario || "0")
    }, 0)
  }

  const subtotal = calculateSubtotal()
  const iva = subtotal * 0.15
  const total = subtotal + iva

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/proveedores" />
            <div>
              <h1 className="text-3xl font-bold">Facturas de Proveedor</h1>
              <p className="text-muted-foreground">Gestión de facturas y pagos</p>
            </div>
          </div>

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
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
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
                                  value={item.producto_id?.toString() || "0"} // Updated default value to "0"
                                  onValueChange={(value) =>
                                    updateItem(index, "producto_id", value ? Number(value) : null)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar producto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Sin producto</SelectItem> // Updated value to "0"
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
                                  onChange={(e) => updateItem(index, "descripcion", e.target.value)}
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
                                  onChange={(e) => updateItem(index, "cantidad", e.target.value)}
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
                                  onChange={(e) => updateItem(index, "precio_unitario", e.target.value)}
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Subtotal</Label>
                                <Input
                                  value={formatCurrency(
                                    (
                                      Number.parseFloat(item.cantidad) * Number.parseFloat(item.precio_unitario)
                                    ).toString(),
                                  )}
                                  disabled
                                />
                              </div>
                            </div>

                            {items.length > 1 && (
                              <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(index)}>
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
                          <span className="font-medium">{formatCurrency(subtotal.toString())}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA (15%):</span>
                          <span className="font-medium">{formatCurrency(iva.toString())}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                          <span>Total:</span>
                          <span>{formatCurrency(total.toString())}</span>
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
                  <Button type="submit">Crear Factura</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
              <SelectItem value="anulada">Anuladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando facturas...</div>
        ) : facturas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron facturas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {facturas.map((factura) => (
              <Card key={factura.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-xl">{factura.numero_factura}</CardTitle>
                      </div>
                      <CardDescription>
                        Emisión: {formatDate(factura.fecha_emision)}
                        {factura.fecha_vencimiento && ` • Vence: ${formatDate(factura.fecha_vencimiento)}`}
                      </CardDescription>
                    </div>
                    <Badge className={estadoColors[factura.estado]}>{estadoLabels[factura.estado]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{formatCurrency(factura.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IVA:</span>
                        <span>{formatCurrency(factura.iva)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(factura.total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pagado:</span>
                        <span className="text-green-600 font-medium">{formatCurrency(factura.pagado)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Saldo:</span>
                        <span className="text-red-600">{formatCurrency(factura.saldo)}</span>
                      </div>
                    </div>
                  </div>

                  {factura.estado !== "anulada" && factura.estado !== "pagada" && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedFactura(factura)
                          setPagoDialogOpen(true)
                        }}
                      >
                        <DollarSign className="mr-2 h-3 w-3" />
                        Registrar Pago
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleAnular(factura.id)}>
                        <AlertCircle className="mr-2 h-3 w-3" />
                        Anular
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog
          open={pagoDialogOpen}
          onOpenChange={(open) => {
            setPagoDialogOpen(open)
            if (!open) {
              setSelectedFactura(null)
              resetPagoForm()
            }
          }}
        >
          <DialogContent className="sm:max-w-[400px]">
            <form onSubmit={handlePago}>
              <DialogHeader>
                <DialogTitle>Registrar Pago</DialogTitle>
                <DialogDescription>{selectedFactura && `Factura: ${selectedFactura.numero_factura}`}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {selectedFactura && (
                  <Alert>
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Saldo pendiente:</p>
                        <p className="text-2xl font-bold">{formatCurrency(selectedFactura.saldo)}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="monto">Monto *</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedFactura?.saldo}
                    value={pagoData.monto}
                    onChange={(e) => setPagoData({ ...pagoData, monto: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metodo">Método de Pago</Label>
                  <Input
                    id="metodo"
                    value={pagoData.metodo}
                    onChange={(e) => setPagoData({ ...pagoData, metodo: e.target.value })}
                    placeholder="Transferencia, Efectivo, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referencia">Referencia</Label>
                  <Input
                    id="referencia"
                    value={pagoData.referencia}
                    onChange={(e) => setPagoData({ ...pagoData, referencia: e.target.value })}
                    placeholder="Número de transacción"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacion">Observación</Label>
                  <Textarea
                    id="observacion"
                    value={pagoData.observacion}
                    onChange={(e) => setPagoData({ ...pagoData, observacion: e.target.value })}
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
    </div>
  )
}
