"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Building2, FileText, Pencil, Plus, Power } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { alternarEstadoProveedorAction } from "@/app/(admin)/admin/proveedores/actions"
import { ProveedorFormDialog } from "./proveedor-form-dialog"
import type { Proveedor } from "./types"

export function NuevoProveedorButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Proveedor
      </Button>
      <ProveedorFormDialog open={open} onOpenChange={setOpen} proveedor={null} />
    </>
  )
}

export function ProveedoresGrid({ proveedores, canUpdate }: { proveedores: Proveedor[]; canUpdate: boolean }) {
  // `editando` se conserva al cerrar para no cambiar el contenido del diálogo
  // durante la animación de salida.
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleToggleStatus = (proveedor: Proveedor) => {
    const action = proveedor.activo ? "inhabilitar" : "habilitar"
    if (!confirm(`¿Estás seguro de ${action} este proveedor?`)) return
    startTransition(async () => {
      const result = await alternarEstadoProveedorAction(proveedor.id)
      if (!result.ok) alert(result.error)
    })
  }

  if (proveedores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No se encontraron proveedores</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
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
                <Badge className="transition-[background-color,color] duration-200 ease" variant={proveedor.activo ? "default" : "secondary"}>
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
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditando(proveedor)
                      setDialogOpen(true)
                    }}
                    className="flex-1"
                  >
                    <Pencil className="mr-2 h-3 w-3" />
                    Editar
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/proveedores/${proveedor.id}/facturas`} aria-label="Facturas">
                    <FileText className="h-3 w-3" />
                  </Link>
                </Button>
                {canUpdate && (
                  <Button
                    variant={proveedor.activo ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleStatus(proveedor)}
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

      <ProveedorFormDialog open={dialogOpen} onOpenChange={setDialogOpen} proveedor={editando} />
    </>
  )
}
