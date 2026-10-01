"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Power } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { alternarEstadoClienteAction } from "@/app/(admin)/admin/clientes/actions"
import { ClienteFormDialog } from "./cliente-form-dialog"
import type { Cliente } from "./types"

// Botón "Nuevo Cliente": vive en el encabezado, separado de la lista.
export function NuevoClienteButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Cliente
      </Button>
      <ClienteFormDialog open={open} onOpenChange={setOpen} cliente={null} />
    </>
  )
}

interface ClientesGridProps {
  clientes: Cliente[]
  canEdit: boolean
  canToggleStatus: boolean
}

export function ClientesGrid({ clientes, canEdit, canToggleStatus }: ClientesGridProps) {
  // `editando` se conserva al cerrar para no cambiar el contenido del diálogo
  // durante la animación de salida.
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleToggleStatus = (cliente: Cliente) => {
    const action = cliente.activo ? "inhabilitar" : "habilitar"
    if (!confirm(`¿Estás seguro de ${action} este cliente?`)) return
    startTransition(async () => {
      const result = await alternarEstadoClienteAction(cliente.id)
      if (!result.ok) alert(result.error)
    })
  }

  if (clientes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No se encontraron clientes</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clientes.map((cliente) => (
          <Card key={cliente.id} className={!cliente.activo ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{cliente.nombre}</CardTitle>
                  <CardDescription>ID: {cliente.id}</CardDescription>
                </div>
                <Badge className="transition-[background-color,color] duration-200 ease" variant={cliente.activo ? "default" : "secondary"}>{cliente.activo ? "Activo" : "Inactivo"}</Badge>
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
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditando(cliente)
                      setDialogOpen(true)
                    }}
                    className="flex-1"
                  >
                    <Pencil className="mr-2 h-3 w-3" />
                    Editar
                  </Button>
                )}
                {canToggleStatus && (
                  <Button
                    variant={cliente.activo ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleStatus(cliente)}
                    disabled={isPending}
                  >
                    <Power className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ClienteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} cliente={editando} />
    </>
  )
}
