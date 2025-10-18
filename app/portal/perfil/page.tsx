"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, User, Lock, ArrowLeft, CheckCircle2, LogOut } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Cliente {
  id: number
  nombre: string
  email: string
  telefono: string | null
  direccion: string | null
  cedula: string | null // Added cedula field
}

export default function PerfilPage() {
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Perfil form
  const [perfilForm, setPerfilForm] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
  })
  const [perfilLoading, setPerfilLoading] = useState(false)

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    fetchCliente()
  }, [])

  const fetchCliente = async () => {
    try {
      const response = await fetch("/api/portal/me")
      const data = await response.json()

      if (!response.ok) {
        router.push("/portal/login")
        return
      }

      setCliente(data.cliente)
      setPerfilForm({
        nombre: data.cliente.nombre,
        telefono: data.cliente.telefono || "",
        direccion: data.cliente.direccion || "",
      })
    } catch (err) {
      console.error("[v0] Error fetching cliente:", err)
      router.push("/portal/login")
    } finally {
      setLoading(false)
    }
  }

  const handlePerfilSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setPerfilLoading(true)

    try {
      const response = await fetch("/api/portal/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perfilForm),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Error al actualizar perfil")
        return
      }

      setSuccess("Perfil actualizado exitosamente")
      fetchCliente()
    } catch (err) {
      setError("Error de conexión")
    } finally {
      setPerfilLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (passwordForm.newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres")
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    setPasswordLoading(true)

    try {
      const response = await fetch("/api/portal/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Error al cambiar contraseña")
        return
      }

      setSuccess("¡Contraseña actualizada exitosamente!")
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (err) {
      setError("Error de conexión")
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/portal/logout", { method: "POST" })
      window.location.href = "/catalogo"
    } catch (err) {
      console.error("[v0] Error logging out:", err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
        <p className="text-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="text-gray-600">Gestiona tu información personal</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/catalogo")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Catálogo
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="perfil" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="perfil">
              <User className="mr-2 h-4 w-4" />
              Información Personal
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="mr-2 h-4 w-4" />
              Cambiar Contraseña
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil">
            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>Actualiza tus datos de contacto</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePerfilSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre Completo *</Label>
                    <Input
                      id="nombre"
                      type="text"
                      value={perfilForm.nombre}
                      onChange={(e) => setPerfilForm({ ...perfilForm, nombre: e.target.value })}
                      required
                      disabled={perfilLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cedula">Cédula</Label>
                    <Input id="cedula" type="text" value={cliente?.cedula || ""} disabled />
                    <p className="text-xs text-muted-foreground">La cédula no se puede cambiar</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={cliente?.email || ""} disabled />
                    <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      type="tel"
                      value={perfilForm.telefono}
                      onChange={(e) => setPerfilForm({ ...perfilForm, telefono: e.target.value })}
                      disabled={perfilLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      type="text"
                      value={perfilForm.direccion}
                      onChange={(e) => setPerfilForm({ ...perfilForm, direccion: e.target.value })}
                      disabled={perfilLoading}
                    />
                  </div>

                  <Button type="submit" disabled={perfilLoading}>
                    {perfilLoading ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Cambiar Contraseña</CardTitle>
                <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Contraseña Actual *</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        required
                        disabled={passwordLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        disabled={passwordLoading}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva Contraseña *</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        required
                        disabled={passwordLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        disabled={passwordLoading}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repite la nueva contraseña"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        required
                        disabled={passwordLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        disabled={passwordLoading}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={passwordLoading}>
                    {passwordLoading ? "Actualizando..." : "Cambiar Contraseña"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
