"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cambiarPasswordPropiaAction } from "@/app/cambiar-password/actions"

export function CambiarPasswordForm({ nombre, obligatorio }: { nombre: string; obligatorio: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ actual: "", nueva: "", confirmar: "" })
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (form.nueva !== form.confirmar) {
      setError("Las contraseñas nuevas no coinciden")
      return
    }
    startTransition(async () => {
      const result = await cambiarPasswordPropiaAction({ currentPassword: form.actual, newPassword: form.nueva })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push("/admin/dashboard")
      router.refresh()
    })
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Cambiar contraseña</CardTitle>
        <CardDescription className="text-center">
          {obligatorio
            ? `Hola ${nombre}: tu contraseña fue asignada por otra persona. Cámbiala para continuar.`
            : "Ingresa tu contraseña actual y la nueva."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="password-actual">Contraseña actual</Label>
            <Input
              id="password-actual"
              type="password"
              autoComplete="current-password"
              value={form.actual}
              onChange={(e) => setForm({ ...form, actual: e.target.value })}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-nueva">Nueva contraseña</Label>
            <Input
              id="password-nueva"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={form.nueva}
              onChange={(e) => setForm({ ...form, nueva: e.target.value })}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-confirmar">Confirmar nueva contraseña</Label>
            <Input
              id="password-confirmar"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={form.confirmar}
              onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
              required
              disabled={isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            Cambiar contraseña
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={handleLogout} disabled={isPending}>
            Cerrar sesión
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
