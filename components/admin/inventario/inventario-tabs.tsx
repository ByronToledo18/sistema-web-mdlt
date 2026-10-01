"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { AlertCircle, Package, Pencil, Plus, Trash2, Wrench } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  alternarEstadoProductoAction,
  alternarEstadoServicioAction,
  eliminarProductoAction,
  eliminarServicioAction,
} from "@/app/(admin)/admin/inventario/actions"
import type { ActionResult } from "@/server/auth/action"
import { formatCurrency } from "@/components/admin/format"
import { IVA_PORCENTAJE } from "@/lib/iva"
import { ProductoFormDialog } from "./producto-form-dialog"
import { ServicioFormDialog } from "./servicio-form-dialog"
import type { Producto, Servicio } from "./types"

interface InventarioTabsProps {
  productos: Producto[]
  servicios: Servicio[]
  canManage: boolean
}

type Editando = { tipo: "producto"; item: Producto | null } | { tipo: "servicio"; item: Servicio | null }

export function InventarioTabs({ productos, servicios, canManage }: InventarioTabsProps) {
  // `editando` se conserva al cerrar para que el diálogo no cambie de
  // contenido durante la animación de salida.
  const [editando, setEditandoState] = useState<Editando | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const run = (action: () => Promise<ActionResult>) => {
    setError("")
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error)
    })
  }

  const handleDelete = (tipo: "producto" | "servicio", id: number) => {
    if (!confirm(`¿Estás seguro de eliminar este ${tipo}?`)) return
    run(() => (tipo === "producto" ? eliminarProductoAction(id) : eliminarServicioAction(id)))
  }

  const handleToggleStatus = (tipo: "producto" | "servicio", id: number) => {
    run(() => (tipo === "producto" ? alternarEstadoProductoAction(id) : alternarEstadoServicioAction(id)))
  }

  const setEditando = (value: Editando) => {
    setEditandoState(value)
    setDialogOpen(true)
  }

  return (
    <>
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
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setEditando({ tipo: "producto", item: null })}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Producto
              </Button>
            </div>
          )}

          {productos.length === 0 ? (
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
                      <Image src={producto.imagen_url} alt={producto.nombre} fill className="object-cover" />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{producto.nombre}</CardTitle>
                        <CardDescription>{producto.sku || "Sin SKU"}</CardDescription>
                      </div>
                      <Badge className="transition-[background-color,color] duration-200 ease" variant={producto.activo ? "default" : "secondary"}>
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
                      <span className="text-sm text-muted-foreground">IVA:</span>
                      <Badge variant={producto.graba_iva ? "outline" : "secondary"}>
                        {producto.graba_iva ? `Grava ${IVA_PORCENTAJE} %` : "No grava"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Stock:</span>
                      <span className={`font-medium ${producto.stock === 0 ? "text-red-600" : ""}`}>
                        {producto.stock} unidades
                      </span>
                    </div>

                    {canManage && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditando({ tipo: "producto", item: producto })}
                          className="flex-1"
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          variant={producto.activo ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleToggleStatus("producto", producto.id)}
                          disabled={isPending}
                        >
                          {producto.activo ? "Inhabilitar" : "Habilitar"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete("producto", producto.id)}
                          disabled={isPending}
                        >
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
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setEditando({ tipo: "servicio", item: null })}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Servicio
              </Button>
            </div>
          )}

          {servicios.length === 0 ? (
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
                        <Image src={servicio.imagen_url} alt={servicio.nombre} fill className="object-cover" />
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{servicio.nombre}</CardTitle>
                        <CardDescription>{servicio.unidad || "Sin unidad"}</CardDescription>
                      </div>
                      <Badge className="transition-[background-color,color] duration-200 ease" variant={servicio.activo ? "default" : "secondary"}>
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
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">IVA:</span>
                      <Badge variant={servicio.graba_iva ? "outline" : "secondary"}>
                        {servicio.graba_iva ? `Grava ${IVA_PORCENTAJE} %` : "No grava"}
                      </Badge>
                    </div>

                    {canManage && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditando({ tipo: "servicio", item: servicio })}
                          className="flex-1"
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          variant={servicio.activo ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleToggleStatus("servicio", servicio.id)}
                          disabled={isPending}
                        >
                          {servicio.activo ? "Inhabilitar" : "Habilitar"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete("servicio", servicio.id)}
                          disabled={isPending}
                        >
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

      <ProductoFormDialog
        open={dialogOpen && editando?.tipo === "producto"}
        onOpenChange={setDialogOpen}
        producto={editando?.tipo === "producto" ? editando.item : null}
      />
      <ServicioFormDialog
        open={dialogOpen && editando?.tipo === "servicio"}
        onOpenChange={setDialogOpen}
        servicio={editando?.tipo === "servicio" ? editando.item : null}
      />
    </>
  )
}
