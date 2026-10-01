"use client"

import { useState, useTransition } from "react"
import { Key, Power, UserCog } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  alternarEstadoUsuarioAction,
  cambiarRolUsuarioAction,
  resetearPasswordUsuarioAction,
} from "@/app/(admin)/admin/soporte/actions"
import type { ActionResult } from "@/server/auth/action"
import type { Rol, Usuario } from "./types"

interface UsuariosTableProps {
  usuarios: Usuario[]
  roles: Rol[]
  canUpdate: boolean
}

export function UsuariosTable({ usuarios, roles, canUpdate }: UsuariosTableProps) {
  const [editRoleUser, setEditRoleUser] = useState<Usuario | null>(null)
  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [newRoleId, setNewRoleId] = useState(0)
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [isPending, startTransition] = useTransition()

  // Ejecuta la acción; si sale bien muestra `okMessage` (si hay) y corre `onOk`.
  const run = (action: () => Promise<ActionResult>, okMessage: string | null, onOk?: () => void) => {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        alert(result.error)
        return
      }
      if (okMessage) alert(okMessage)
      onOk?.()
    })
  }

  const handleChangeRole = () => {
    if (!editRoleUser || !newRoleId) return
    run(() => cambiarRolUsuarioAction(editRoleUser.id, { rol_id: newRoleId }), "Rol actualizado correctamente", () => {
      setEditRoleOpen(false)
      setNewRoleId(0)
    })
  }

  const handleResetPassword = () => {
    if (!resetUserId || !newPassword) return
    run(
      () => resetearPasswordUsuarioAction(resetUserId, { nueva_password: newPassword }),
      "Contraseña actualizada correctamente",
      () => {
        setResetOpen(false)
        setNewPassword("")
      },
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            {canUpdate && <TableHead>Acciones</TableHead>}
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
                <Badge className="transition-[background-color,color] duration-200 ease" variant={usuario.activo ? "default" : "secondary"}>{usuario.activo ? "Activo" : "Inactivo"}</Badge>
              </TableCell>
              {canUpdate && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditRoleUser(usuario)
                        setNewRoleId(usuario.rol_id)
                        setEditRoleOpen(true)
                      }}
                    >
                      <UserCog className="h-4 w-4 mr-1" />
                      Rol
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetUserId(usuario.id)
                        setResetOpen(true)
                      }}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      variant={usuario.activo ? "destructive" : "default"}
                      onClick={() => run(() => alternarEstadoUsuarioAction(usuario.id), null)}
                      disabled={isPending}
                    >
                      <Power className="h-4 w-4 mr-1" />
                      {usuario.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Rol de Usuario</DialogTitle>
            <DialogDescription>Cambia el rol de {editRoleUser?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-role">Nuevo Rol</Label>
              <Select value={newRoleId.toString()} onValueChange={(value) => setNewRoleId(Number.parseInt(value))}>
                <SelectTrigger id="new-role">
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
            <Button variant="outline" onClick={() => setEditRoleOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangeRole} disabled={isPending}>
              Cambiar Rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
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
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isPending}>
              Actualizar Contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
