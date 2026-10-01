"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { Check, Copy } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { actualizarClienteAction, crearClienteAction } from "@/app/(admin)/admin/clientes/actions"
import type { Cliente } from "./types"

interface ClienteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // null = cliente nuevo.
  cliente: Cliente | null
}

export function ClienteFormDialog({ open, onOpenChange, cliente }: ClienteFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* key: el formulario se reinicia cada vez que cambia el cliente editado */}
        <ClienteForm key={cliente?.id ?? "nuevo"} cliente={cliente} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ClienteForm({ cliente, onDone }: { cliente: Cliente | null; onDone: () => void }) {
  const [formData, setFormData] = useState({
    nombre: cliente?.nombre ?? "",
    cedula: cliente?.cedula ?? "",
    telefono: cliente?.telefono ?? "",
    email: cliente?.email ?? "",
    direccion: cliente?.direccion ?? "",
    notas: cliente?.notas ?? "",
  })
  const [error, setError] = useState("")
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      if (cliente) {
        const result = await actualizarClienteAction(cliente.id, formData)
        if (!result.ok) return setError(result.error)
        onDone()
      } else {
        const result = await crearClienteAction(formData)
        if (!result.ok) return setError(result.error)
        setTempPassword(result.data.tempPassword)
      }
    })
  }

  const handleCopyPassword = async () => {
    if (!tempPassword) return
    await navigator.clipboard.writeText(tempPassword)
    setPasswordCopied(true)
    setTimeout(() => setPasswordCopied(false), 2000)
  }

  if (tempPassword) {
    return (
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
                    {passwordCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
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
          <Button onClick={onDone}>Entendido</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{cliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
        <DialogDescription>
          {cliente ? "Actualiza la información del cliente" : "Ingresa los datos del nuevo cliente"}
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
        <Button type="submit" disabled={isPending}>
          {cliente ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  )
}
