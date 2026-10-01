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
import { Plus, Search, Pencil, Power, FileText, Building2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"

interface Proveedor {
  id: number
  nombre: string
  ruc: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  notas: string | null
  activo: boolean
}

export default function ProveedoresPage() {
  const router = useRouter()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null)
  const [error, setError] = useState("")
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    ruc: "",
    telefono: "",
    email: "",
    direccion: "",
    contacto_nombre: "",
    contacto_telefono: "",
    notas: "",
  })

  useEffect(() => {
    fetchProveedores()
  }, [search, mostrarInactivos])

  const fetchProveedores = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (mostrarInactivos) params.append("mostrarInactivos", "true")

      const response = await fetch(`/api/proveedores?${params}`)
      const data = await response.json()

      if (response.ok) {
        setProveedores(data.proveedores)
      }
    } catch (err) {
      console.error("[v0] Error fetching proveedores:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingProveedor ? `/api/proveedores/${editingProveedor.id}` : "/api/proveedores"
      const method = editingProveedor ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setDialogOpen(false)
      resetForm()
      fetchProveedores()
    } catch (err) {
      setError("Error al guardar proveedor")
    }
  }

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor)
    setFormData({
      nombre: proveedor.nombre,
      ruc: proveedor.ruc || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      direccion: proveedor.direccion || "",
      contacto_nombre: proveedor.contacto_nombre || "",
      contacto_telefono: proveedor.contacto_telefono || "",
      notas: proveedor.notas || "",
    })
    setDialogOpen(true)
  }

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? "inhabilitar" : "habilitar"
    if (!confirm(`¿Estás seguro de ${action} este proveedor?`)) return

    try {
      const response = await fetch(`/api/proveedores/${id}/toggle-status`, { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        fetchProveedores()
      } else {
        alert(data.error || `Error al ${action} proveedor`)
      }
    } catch (err) {
      console.error(`[v0] Error toggling proveedor status:`, err)
      alert(`Error al ${action} proveedor`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este proveedor?")) return

    try {
      const response = await fetch(`/api/proveedores/${id}`, { method: "DELETE" })
      const data = await response.json()

      if (response.ok) {
        fetchProveedores()
      } else {
        alert(data.error || "Error al eliminar proveedor")
      }
    } catch (err) {
      console.error("[v0] Error deleting proveedor:", err)
      alert("Error al eliminar proveedor")
    }
  }

  const resetForm = () => {
    setFormData({
      nombre: "",
      ruc: "",
      telefono: "",
      email: "",
      direccion: "",
      contacto_nombre: "",
      contacto_telefono: "",
      notas: "",
    })
    setEditingProveedor(null)
    setError("")
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Proveedores</h1>
              <p className="text-muted-foreground">Gestión de proveedores y facturas</p>
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
                Nuevo Proveedor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
                  <DialogDescription>
                    {editingProveedor
                      ? "Actualiza la información del proveedor"
                      : "Ingresa los datos del nuevo proveedor"}
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
                  <Button type="submit">{editingProveedor ? "Actualizar" : "Crear"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, RUC o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="mostrar-inactivos" checked={mostrarInactivos} onCheckedChange={setMostrarInactivos} />
            <Label htmlFor="mostrar-inactivos" className="cursor-pointer">
              Mostrar inactivos
            </Label>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando proveedores...</div>
        ) : proveedores.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron proveedores</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {proveedores.map((proveedor) => (
              <Card key={proveedor.id} className={!proveedor.activo ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{proveedor.nombre}</CardTitle>
                      </div>
                      {proveedor.ruc && <CardDescription>RUC: {proveedor.ruc}</CardDescription>}
                    </div>
                    <Badge variant={proveedor.activo ? "default" : "secondary"}>
                      {proveedor.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {proveedor.telefono && (
                    <p className="text-sm">
                      <span className="font-medium">Tel:</span> {proveedor.telefono}
                    </p>
                  )}
                  {proveedor.email && (
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {proveedor.email}
                    </p>
                  )}
                  {proveedor.contacto_nombre && (
                    <p className="text-sm">
                      <span className="font-medium">Contacto:</span> {proveedor.contacto_nombre}
                      {proveedor.contacto_telefono && ` • ${proveedor.contacto_telefono}`}
                    </p>
                  )}
                  {proveedor.notas && <p className="text-sm text-muted-foreground italic">{proveedor.notas}</p>}

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(proveedor)} className="flex-1">
                      <Pencil className="mr-2 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/proveedores/${proveedor.id}/facturas`)}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={proveedor.activo ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(proveedor.id, proveedor.activo)}
                    >
                      <Power className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
