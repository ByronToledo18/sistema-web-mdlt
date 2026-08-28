"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, Search, Pencil, Trash2, Package, Wrench, AlertCircle, Upload, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { BackButton } from "@/components/ui/back-button"
import Image from "next/image"

interface Producto {
  id: number
  sku: string | null
  nombre: string
  precio: string
  stock: number
  activo: boolean
  imagen_url: string | null
  can_delete?: boolean
}

interface Servicio {
  id: number
  nombre: string
  unidad: string | null
  precio_base: string
  variable: boolean
  activo: boolean
  imagen_url: string | null
  can_delete?: boolean
}

export default function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"producto" | "servicio">("producto")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [error, setError] = useState("")
  const [userRole, setUserRole] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const [productoForm, setProductoForm] = useState({
    sku: "",
    nombre: "",
    precio: "",
    stock: "",
    activo: true,
    imagen_url: null as string | null,
  })

  const [servicioForm, setServicioForm] = useState({
    nombre: "",
    unidad: "",
    precio_base: "",
    variable: false,
    activo: true,
    imagen_url: null as string | null,
  })

  useEffect(() => {
    fetchData()
    fetchUserRole()
  }, [search])

  useEffect(() => {
    fetchData()
  }, [showInactive])

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (!showInactive) params.append("activo", "true")

      const [productosRes, serviciosRes] = await Promise.all([
        fetch(`/api/productos?${params}`),
        fetch(`/api/servicios?${params}`),
      ])

      const productosData = await productosRes.json()
      const serviciosData = await serviciosRes.json()

      if (productosRes.ok) setProductos(productosData.productos)
      if (serviciosRes.ok) setServicios(serviciosData.servicios)
    } catch (err) {
      console.error("[v0] Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserRole = async () => {
    try {
      const response = await fetch("/api/auth/me")
      if (response.ok) {
        const data = await response.json()
        setUserRole(data.user.rol)
      }
    } catch (err) {
      console.error("[v0] Error fetching user role:", err)
    }
  }

  const handleSubmitProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingItem ? `/api/productos/${editingItem.id}` : "/api/productos"
      const method = editingItem ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productoForm,
          precio: Number.parseFloat(productoForm.precio),
          stock: Number.parseInt(productoForm.stock) || 0,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setDialogOpen(false)
      resetForms()
      fetchData()
    } catch (err) {
      setError("Error al guardar producto")
    }
  }

  const handleSubmitServicio = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingItem ? `/api/servicios/${editingItem.id}` : "/api/servicios"
      const method = editingItem ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...servicioForm,
          precio_base: Number.parseFloat(servicioForm.precio_base),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setDialogOpen(false)
      resetForms()
      fetchData()
    } catch (err) {
      setError("Error al guardar servicio")
    }
  }

  const openNewDialog = (type: "producto" | "servicio") => {
    resetForms()
    setDialogType(type)
    setDialogOpen(true)
  }

  const handleEditProducto = (producto: Producto) => {
    setEditingItem(producto)
    setDialogType("producto")
    setProductoForm({
      sku: producto.sku || "",
      nombre: producto.nombre,
      precio: producto.precio,
      stock: producto.stock.toString(),
      activo: producto.activo,
      imagen_url: producto.imagen_url,
    })
    setImagePreview(producto.imagen_url)
    setDialogOpen(true)
  }

  const handleEditServicio = (servicio: Servicio) => {
    setEditingItem(servicio)
    setDialogType("servicio")
    setServicioForm({
      nombre: servicio.nombre,
      unidad: servicio.unidad || "",
      precio_base: servicio.precio_base,
      variable: servicio.variable,
      activo: servicio.activo,
      imagen_url: servicio.imagen_url,
    })
    setImagePreview(servicio.imagen_url)
    setDialogOpen(true)
  }

  const handleDelete = async (tipo: "producto" | "servicio", id: number) => {
    if (!confirm(`¿Estás seguro de eliminar este ${tipo}?`)) return

    try {
      const endpoint = tipo === "producto" ? `/api/productos/${id}` : `/api/servicios/${id}`
      const response = await fetch(endpoint, { method: "DELETE" })
      const data = await response.json()

      if (response.ok) {
        fetchData()
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error(`[v0] Error deleting ${tipo}:`, err)
      setError(`Error al eliminar ${tipo}`)
    }
  }

  const handleToggleStatus = async (tipo: "producto" | "servicio", id: number) => {
    try {
      const endpoint = tipo === "producto" ? `/api/productos/${id}/toggle-status` : `/api/servicios/${id}/toggle-status`
      const response = await fetch(endpoint, { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        fetchData()
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error(`[v0] Error toggling ${tipo} status:`, err)
      setError(`Error al cambiar estado del ${tipo}`)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      // Update form with image URL
      if (dialogType === "producto") {
        setProductoForm({ ...productoForm, imagen_url: data.url })
      } else {
        setServicioForm({ ...servicioForm, imagen_url: data.url })
      }

      setImagePreview(data.url)
    } catch (err) {
      setError("Error al subir la imagen")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    if (dialogType === "producto") {
      setProductoForm({ ...productoForm, imagen_url: null })
    } else {
      setServicioForm({ ...servicioForm, imagen_url: null })
    }
    setImagePreview(null)
  }

  const resetForms = () => {
    setProductoForm({ sku: "", nombre: "", precio: "", stock: "", activo: true, imagen_url: null })
    setServicioForm({ nombre: "", unidad: "", precio_base: "", variable: false, activo: true, imagen_url: null })
    setEditingItem(null)
    setError("")
    setImagePreview(null)
  }

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(Number.parseFloat(value))
  }

  const isAdmin = userRole === "administrador"

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Inventario</h1>
              <p className="text-muted-foreground">
                {isAdmin ? "Gestión de productos y servicios" : "Consulta de productos y servicios"}
              </p>
            </div>
          </div>
        </div>

        {!isAdmin && userRole && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Estás en modo de solo lectura. Para solicitar reposición de productos o servicios, contacta al
              administrador.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos o servicios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="cursor-pointer">
                Mostrar inactivos
              </Label>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="productos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="productos">
              <Package className="mr-2 h-4 w-4" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="servicios">
              <Wrench className="mr-2 h-4 w-4" />
              Servicios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="productos" className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button onClick={() => openNewDialog("producto")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">Cargando productos...</div>
            ) : productos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No se encontraron productos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {productos.map((producto) => (
                  <Card key={producto.id} className="relative">
                    {producto.imagen_url && (
                      <div className="mb-3 relative w-full h-32 rounded-md overflow-hidden bg-muted">
                        {producto.stock === 0 && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                            <span className="text-white text-2xl font-bold">AGOTADO</span>
                          </div>
                        )}
                        <Image
                          src={producto.imagen_url || "/placeholder.svg"}
                          alt={producto.nombre}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{producto.nombre}</CardTitle>
                          <CardDescription>{producto.sku || "Sin SKU"}</CardDescription>
                        </div>
                        <Badge variant={producto.activo ? "default" : "secondary"}>
                          {producto.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Precio:</span>
                        <span className="text-lg font-bold">{formatCurrency(producto.precio)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Stock:</span>
                        <span className={`font-medium ${producto.stock === 0 ? "text-red-600" : ""}`}>
                          {producto.stock} unidades
                        </span>
                      </div>

                      {isAdmin && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProducto(producto)}
                            className="flex-1"
                          >
                            <Pencil className="mr-2 h-3 w-3" />
                            Editar
                          </Button>
                          <Button
                            variant={producto.activo ? "secondary" : "default"}
                            size="sm"
                            onClick={() => handleToggleStatus("producto", producto.id)}
                          >
                            {producto.activo ? "Inhabilitar" : "Habilitar"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete("producto", producto.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="servicios" className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button onClick={() => openNewDialog("servicio")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Servicio
                </Button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">Cargando servicios...</div>
            ) : servicios.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No se encontraron servicios</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {servicios.map((servicio) => (
                  <Card key={servicio.id}>
                    <CardHeader>
                      {servicio.imagen_url && (
                        <div className="mb-3 relative w-full h-32 rounded-md overflow-hidden bg-muted">
                          <Image
                            src={servicio.imagen_url || "/placeholder.svg"}
                            alt={servicio.nombre}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{servicio.nombre}</CardTitle>
                          <CardDescription>{servicio.unidad || "Sin unidad"}</CardDescription>
                        </div>
                        <Badge variant={servicio.activo ? "default" : "secondary"}>
                          {servicio.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Precio base:</span>
                        <span className="text-lg font-bold">{formatCurrency(servicio.precio_base)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Precio:</span>
                        <Badge variant={servicio.variable ? "outline" : "secondary"}>
                          {servicio.variable ? "Variable" : "Fijo"}
                        </Badge>
                      </div>

                      {isAdmin && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditServicio(servicio)}
                            className="flex-1"
                          >
                            <Pencil className="mr-2 h-3 w-3" />
                            Editar
                          </Button>
                          <Button
                            variant={servicio.activo ? "secondary" : "default"}
                            size="sm"
                            onClick={() => handleToggleStatus("servicio", servicio.id)}
                          >
                            {servicio.activo ? "Inhabilitar" : "Habilitar"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete("servicio", servicio.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForms()
          }}
        >
          <DialogContent className="sm:max-w-[500px]">
            {dialogType === "producto" ? (
              <form onSubmit={handleSubmitProducto}>
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "Actualiza la información del producto" : "Ingresa los datos del nuevo producto"}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label>Imagen del Producto</Label>
                    {imagePreview ? (
                      <div className="relative w-full h-48 rounded-md overflow-hidden bg-muted">
                        <Image src={imagePreview || "/placeholder.svg"} alt="Preview" fill className="object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={handleRemoveImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-md p-6 text-center">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                        <Label htmlFor="image-upload" className="cursor-pointer text-sm text-muted-foreground">
                          {uploading ? "Subiendo..." : "Click para subir imagen"}
                        </Label>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={productoForm.sku}
                      onChange={(e) => setProductoForm({ ...productoForm, sku: e.target.value })}
                      placeholder="TUTU-001"
                      disabled={!!editingItem}
                    />
                    {editingItem && (
                      <p className="text-xs text-muted-foreground">
                        El SKU no puede ser modificado después de la creación
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={productoForm.nombre}
                      onChange={(e) => setProductoForm({ ...productoForm, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="precio">Precio *</Label>
                      <Input
                        id="precio"
                        type="number"
                        step="0.01"
                        min="0"
                        value={productoForm.precio}
                        onChange={(e) => setProductoForm({ ...productoForm, precio: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock</Label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        value={productoForm.stock}
                        onChange={(e) => setProductoForm({ ...productoForm, stock: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="activo"
                      checked={productoForm.activo}
                      onCheckedChange={(checked) => setProductoForm({ ...productoForm, activo: checked })}
                    />
                    <Label htmlFor="activo">Producto activo</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit">{editingItem ? "Actualizar" : "Crear"}</Button>
                </DialogFooter>
              </form>
            ) : (
              <form onSubmit={handleSubmitServicio}>
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "Actualiza la información del servicio" : "Ingresa los datos del nuevo servicio"}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label>Imagen del Servicio</Label>
                    {imagePreview ? (
                      <div className="relative w-full h-48 rounded-md overflow-hidden bg-muted">
                        <Image src={imagePreview || "/placeholder.svg"} alt="Preview" fill className="object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={handleRemoveImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-md p-6 text-center">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                        <Label htmlFor="image-upload-servicio" className="cursor-pointer text-sm text-muted-foreground">
                          {uploading ? "Subiendo..." : "Click para subir imagen"}
                        </Label>
                        <Input
                          id="image-upload-servicio"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nombre-servicio">Nombre *</Label>
                    <Input
                      id="nombre-servicio"
                      value={servicioForm.nombre}
                      onChange={(e) => setServicioForm({ ...servicioForm, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unidad">Unidad</Label>
                      <Input
                        id="unidad"
                        value={servicioForm.unidad}
                        onChange={(e) => setServicioForm({ ...servicioForm, unidad: e.target.value })}
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
                        value={servicioForm.precio_base}
                        onChange={(e) => setServicioForm({ ...servicioForm, precio_base: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="variable"
                      checked={servicioForm.variable}
                      onCheckedChange={(checked) => setServicioForm({ ...servicioForm, variable: checked })}
                    />
                    <Label htmlFor="variable">Precio variable</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="activo-servicio"
                      checked={servicioForm.activo}
                      onCheckedChange={(checked) => setServicioForm({ ...servicioForm, activo: checked })}
                    />
                    <Label htmlFor="activo-servicio">Servicio activo</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit">{editingItem ? "Actualizar" : "Crear"}</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
