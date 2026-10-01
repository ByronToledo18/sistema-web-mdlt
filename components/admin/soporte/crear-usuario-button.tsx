"use client"

import { useState, useTransition } from "react"
import { UserPlus } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { crearUsuarioAction } from "@/app/(admin)/admin/soporte/actions"
import type { Rol } from "./types"

const emptyUser = { nombre: "", email: "", password: "", rol_id: 0 }

export function CrearUsuarioButton({ roles }: { roles: Rol[] }) {
  const [open, setOpen] = useState(false)
  const [newUser, setNewUser] = useState(emptyUser)
  const [isPending, startTransition] = useTransition()

  const handleCreateUser = () => {
    if (!newUser.nombre || !newUser.email || !newUser.password || !newUser.rol_id) {
      alert("Por favor completa todos los campos")
      return
    }
    startTransition(async () => {
      const result = await crearUsuarioAction(newUser)
      if (!result.ok) {
        alert(result.error)
        return
      }
      alert("Usuario creado correctamente")
      setOpen(false)
      setNewUser(emptyUser)
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-2" />
        Crear Usuario
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
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
                <SelectTrigger id="rol">
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isPending}>
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
