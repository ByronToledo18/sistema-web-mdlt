"use client"

import type React from "react"
import Link from "next/link"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/admin/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetMessage, setResetMessage] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Error al iniciar sesión")
        return
      }

      router.push(redirect)
      router.refresh()
    } catch (err) {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)

    try {
      const response = await fetch("/api/soporte/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "reseteo_contraseña",
          prioridad: "alta",
          descripcion: `Solicitud de reseteo de contraseña para el usuario: ${resetEmail}\n\nMensaje: ${resetMessage}`,
          email_contacto: resetEmail,
        }),
      })

      if (!response.ok) {
        throw new Error("Error al enviar la solicitud")
      }

      setResetSuccess(true)
      setTimeout(() => {
        setResetDialogOpen(false)
        setResetSuccess(false)
        setResetEmail("")
        setResetMessage("")
      }, 3000)
    } catch (err) {
      alert("Error al enviar la solicitud. Por favor, intenta nuevamente.")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100 p-4">
      <Link href="/catalogo" className="absolute top-4 left-4">
        <Button
          variant="outline"
          className="gap-2 bg-card text-card-foreground hover:bg-primary hover:text-primary-foreground border-border"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Catálogo
        </Button>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">El Mundo de las Tutus</CardTitle>
          <CardDescription className="text-center">Ingresa tus credenciales para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Solicitar Reseteo de Contraseña</DialogTitle>
                      <DialogDescription>
                        Envía una solicitud al soporte técnico para resetear tu contraseña.
                      </DialogDescription>
                    </DialogHeader>
                    {resetSuccess ? (
                      <Alert>
                        <AlertDescription>
                          ¡Solicitud enviada exitosamente! El equipo de soporte se pondrá en contacto contigo pronto.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <form onSubmit={handleResetRequest} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="tu@email.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                            disabled={resetLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reset-message">Mensaje (opcional)</Label>
                          <Textarea
                            id="reset-message"
                            placeholder="Describe tu situación..."
                            value={resetMessage}
                            onChange={(e) => setResetMessage(e.target.value)}
                            disabled={resetLoading}
                            rows={3}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={resetLoading}>
                          {resetLoading ? "Enviando..." : "Enviar Solicitud"}
                        </Button>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
