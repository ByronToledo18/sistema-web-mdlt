"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, Users, FileText, Key, Power, UserPlus, UserCog } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"

interface Usuario {
  id: number
  nombre: string
  email: string
  rol_id: number
  rol_nombre: string
  activo: boolean
  created_at: string
}

interface Rol {
  id: number
  nombre: string
  descripcion: string
}

interface AuditLog {
  id: number
  usuario_nombre: string
  usuario_email: string
  accion: string
  modulo: string
  descripcion: string
  fecha: string
}

export default function SoportePage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const [newUser, setNewUser] = useState({
    nombre: "",
    email: "",
    password: "",
    rol_id: 0,
  })

  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [newRoleId, setNewRoleId] = useState<number>(0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usuariosRes, auditRes, rolesRes] = await Promise.all([
        fetch("/api/soporte/usuarios"),
        fetch("/api/soporte/auditoria?limit=50"),
        fetch("/api/soporte/roles"),
      ])

      if (usuariosRes.ok) {
        const usuariosData = await usuariosRes.json()
        setUsuarios(usuariosData)
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json()
        setAuditLogs(auditData)
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData)
      }
    } catch (error) {
      console.error("[v0] Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.nombre || !newUser.email || !newUser.password || !newUser.rol_id) {
      alert("Por favor completa todos los campos")
      return
    }

    try {
      const res = await fetch("/api/soporte/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })

      if (res.ok) {
        alert("Usuario creado correctamente")
        setCreateUserDialogOpen(false)
        setNewUser({ nombre: "", email: "", password: "", rol_id: 0 })
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || "Error al crear usuario")
      }
    } catch (error) {
      console.error("[v0] Error creating user:", error)
      alert("Error al crear usuario")
    }
  }

  const handleChangeRole = async () => {
    if (!editingUser || !newRoleId) return

    try {
      const res = await fetch(`/api/soporte/usuarios/${editingUser.id}/change-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol_id: newRoleId }),
      })

      if (res.ok) {
        alert("Rol actualizado correctamente")
        setEditRoleDialogOpen(false)
        setEditingUser(null)
        setNewRoleId(0)
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || "Error al cambiar rol")
      }
    } catch (error) {
      console.error("[v0] Error changing role:", error)
      alert("Error al cambiar rol")
    }
  }

  const handleResetPassword = async () => {
    if (!selectedUserId || !newPassword) return

    try {
      const res = await fetch(`/api/soporte/usuarios/${selectedUserId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nueva_password: newPassword }),
      })

      if (res.ok) {
        alert("Contraseña actualizada correctamente")
        setResetDialogOpen(false)
        setNewPassword("")
        setSelectedUserId(null)
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || "Error al resetear contraseña")
      }
    } catch (error) {
      console.error("[v0] Error resetting password:", error)
      alert("Error al resetear contraseña")
    }
  }

  const handleToggleStatus = async (userId: number) => {
    try {
      const res = await fetch(`/api/soporte/usuarios/${userId}/toggle-status`, {
        method: "POST",
      })

      if (res.ok) {
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || "Error al cambiar estado")
      }
    } catch (error) {
      console.error("[v0] Error toggling status:", error)
      alert("Error al cambiar estado del usuario")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando panel de soporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton href="/admin/dashboard" />
          <div>
            <h1 className="text-3xl font-bold">Panel de Soporte Técnico</h1>
            <p className="text-muted-foreground">Gestión de usuarios, roles y auditoría del sistema</p>
          </div>
        </div>
        <Button onClick={() => setCreateUserDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Crear Usuario
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuarios.length}</div>
            <p className="text-xs text-muted-foreground">{usuarios.filter((u) => u.activo).length} activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles del Sistema</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">Perfiles configurados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones Registradas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}</div>
            <p className="text-xs text-muted-foreground">Últimas 50 acciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Operativo</div>
            <p className="text-xs text-muted-foreground">Todos los servicios activos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Administra usuarios, resetea contraseñas, cambia roles y controla accesos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">{usuario.nombre}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{usuario.rol_nombre}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? "default" : "secondary"}>
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(usuario)
                          setNewRoleId(usuario.rol_id)
                          setEditRoleDialogOpen(true)
                        }}
                      >
                        <UserCog className="h-4 w-4 mr-1" />
                        Rol
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUserId(usuario.id)
                          setResetDialogOpen(true)
                        }}
                      >
                        <Key className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant={usuario.activo ? "destructive" : "default"}
                        onClick={() => handleToggleStatus(usuario.id)}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        {usuario.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log de Auditoría</CardTitle>
          <CardDescription>Registro de acciones importantes del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{new Date(log.fecha).toLocaleString("es-ES")}</TableCell>
                  <TableCell className="text-sm">{log.usuario_nombre || "Sistema"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.modulo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{log.accion}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.descripcion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>Ingresa los datos del nuevo usuario del sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre Completo</Label>
              <Input
                id="nombre"
                value={newUser.nombre}
                onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="juan@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <Select
                value={newUser.rol_id.toString()}
                onValueChange={(value) => setNewUser({ ...newUser, rol_id: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((rol) => (
                    <SelectItem key={rol.id} value={rol.id.toString()}>
                      {rol.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser}>Crear Usuario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Rol de Usuario</DialogTitle>
            <DialogDescription>Cambia el rol de {editingUser?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-role">Nuevo Rol</Label>
              <Select value={newRoleId.toString()} onValueChange={(value) => setNewRoleId(Number.parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((rol) => (
                    <SelectItem key={rol.id} value={rol.id.toString()}>
                      {rol.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangeRole}>Cambiar Rol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>Ingresa una nueva contraseña para el usuario seleccionado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword}>Actualizar Contraseña</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
