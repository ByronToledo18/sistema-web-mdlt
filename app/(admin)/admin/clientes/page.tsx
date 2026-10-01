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
import { Plus, Search, Pencil, Power, Copy, Check } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

interface Cliente {
  id: number
  nombre: string
  cedula: string | null // Added cedula field
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  activo: boolean
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [error, setError] = useState("")
  const [userRole, setUserRole] = useState<string>("")
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    cedula: "", // Added cedula field
    telefono: "",
    email: "",
    direccion: "",
    notas: "",
  })

  useEffect(() => {
    fetchClientes()
    fetchUserRole()
  }, [search, mostrarInactivos])

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

  const fetchClientes = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (mostrarInactivos) params.append("mostrarInactivos", "true")

      const response = await fetch(`/api/clientes?${params}`)
      const data = await response.json()

      if (response.ok) {
        setClientes(data.clientes)
      }
    } catch (err) {
      console.error("[v0] Error fetching clientes:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingCliente ? `/api/clientes/${editingCliente.id}` : "/api/clientes"
      const method = editingCliente ? "PUT" : "POST"

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

      if (!editingCliente && data.tempPassword) {
        setTempPassword(data.tempPassword)
      } else {
        setDialogOpen(false)
        resetForm()
      }

      fetchClientes()
    } catch (err) {
      setError("Error al guardar cliente")
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre,
      cedula: cliente.cedula || "", // Include cedula in form data
      telefono: cliente.telefono || "",
      email: cliente.email || "",
      direccion: cliente.direccion || "",
      notas: cliente.notas || "",
    })
    setDialogOpen(true)
  }

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? "inhabilitar" : "habilitar"
    if (!confirm(`¿Estás seguro de ${action} este cliente?`)) return

    try {
      const response = await fetch(`/api/clientes/${id}/toggle-status`, { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        fetchClientes()
      } else {
        alert(data.error || `Error al ${action} cliente`)
      }
    } catch (err) {
      console.error(`[v0] Error toggling cliente status:`, err)
      alert(`Error al ${action} cliente`)
    }
  }

  const handleCopyPassword = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    }
  }

  const handleClosePasswordDialog = () => {
    setTempPassword(null)
    setPasswordCopied(false)
    setDialogOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({ nombre: "", cedula: "", telefono: "", email: "", direccion: "", notas: "" }) // Reset cedula
    setEditingCliente(null)
    setError("")
    setTempPassword(null)
    setPasswordCopied(false)
  }

  const canModify = userRole === "administrador" || userRole === "asistente"
  const canToggleStatus = userRole === "administrador"

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Clientes</h1>
              <p className="text-muted-foreground">Gestión de clientes del negocio</p>
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
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              {tempPassword ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Cliente Creado Exitosamente</DialogTitle>
                    <DialogDescription>
                      Se ha generado una contraseña temporal para el cliente. Comparte esta información de forma segura.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <Alert>
                      <AlertDescription className="space-y-3">
                        <div>
                          <p className="font-medium mb-1">Contraseña Temporal:</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-lg font-mono">{tempPassword}</code>
                            <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                              {passwordCopied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ⚠️ El cliente deberá cambiar esta contraseña en su primer inicio de sesión.
                        </p>
                      </AlertDescription>
                    </Alert>

                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p className="font-medium">Instrucciones para el cliente:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Ingresa a la plataforma con tu correo electrónico como usuario</li>
                        <li>Usa la contraseña temporal proporcionada</li>
                        <li>El sistema te pedirá cambiar tu contraseña</li>
                        <li>Elige una contraseña segura y personal</li>
                      </ol>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={handleClosePasswordDialog}>Entendido</Button>
                  </DialogFooter>
                </>
              ) : (
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
                    <DialogDescription>
                      {editingCliente ? "Actualiza la información del cliente" : "Ingresa los datos del nuevo cliente"}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cedula">Cédula *</Label>
                      <Input
                        id="cedula"
                        value={formData.cedula}
                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                        required
                        placeholder="Número de cédula"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono *</Label>
                      <Input
                        id="telefono"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="direccion">Dirección *</Label>
                      <Textarea
                        id="direccion"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        rows={2}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notas">Notas</Label>
                      <Textarea
                        id="notas"
                        value={formData.notas}
                        onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit">{editingCliente ? "Actualizar" : "Crear"}</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o teléfono..."
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
          <div className="text-center py-12">Cargando clientes...</div>
        ) : clientes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron clientes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clientes.map((cliente) => (
              <Card key={cliente.id} className={!cliente.activo ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{cliente.nombre}</CardTitle>
                      <CardDescription>ID: {cliente.id}</CardDescription>
                    </div>
                    <Badge variant={cliente.activo ? "default" : "secondary"}>
                      {cliente.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cliente.cedula && (
                    <p className="text-sm">
                      <span className="font-medium">Cédula:</span> {cliente.cedula}
                    </p>
                  )}
                  {cliente.telefono && (
                    <p className="text-sm">
                      <span className="font-medium">Tel:</span> {cliente.telefono}
                    </p>
                  )}
                  {cliente.email && (
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {cliente.email}
                    </p>
                  )}
                  {cliente.direccion && (
                    <p className="text-sm">
                      <span className="font-medium">Dirección:</span> {cliente.direccion}
                    </p>
                  )}
                  {cliente.notas && <p className="text-sm text-muted-foreground italic">{cliente.notas}</p>}

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)} className="flex-1">
                      <Pencil className="mr-2 h-3 w-3" />
                      Editar
                    </Button>
                    {canToggleStatus && (
                      <Button
                        variant={cliente.activo ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleToggleStatus(cliente.id, cliente.activo)}
                      >
                        <Power className="h-3 w-3" />
                      </Button>
                    )}
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
