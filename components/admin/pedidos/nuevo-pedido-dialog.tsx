"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, UserPlus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { crearPedidoAction } from "@/app/(admin)/admin/pedidos/actions"

interface ClienteOpcion {
  id: number
  nombre: string
}

export function NuevoPedidoDialog({ clientes }: { clientes: ClienteOpcion[] }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [clienteSearch, setClienteSearch] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<ClienteOpcion | null>(null)
  const [isPending, startTransition] = useTransition()

  const resetForm = () => {
    setSelectedCliente(null)
    setClienteSearch("")
    setError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!selectedCliente) {
      setError("Debes seleccionar un cliente")
      return
    }
    startTransition(async () => {
      const result = await crearPedidoAction({ cliente_id: selectedCliente.id })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/admin/pedidos/${result.data.id}`)
    })
  }

  const filteredClientes = clientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(clienteSearch.toLowerCase()),
  )

  return (
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
          Nuevo Pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Pedido</DialogTitle>
            <DialogDescription>
              Crea un nuevo pedido. El código se generará automáticamente y el estado inicial será &quot;Recibido&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="cliente">Cliente *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("/admin/clientes", "_blank")}
                  className="h-7 text-xs"
                >
                  <UserPlus className="mr-1 h-3 w-3" />
                  Crear Cliente
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cliente"
                  placeholder="Buscar cliente por nombre..."
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value)
                    setSelectedCliente(null)
                  }}
                  className="pl-10"
                />
                {clienteSearch && !selectedCliente && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredClientes.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">No se encontraron coincidencias</div>
                    ) : (
                      filteredClientes.map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => {
                            setSelectedCliente(cliente)
                            setClienteSearch(cliente.nombre)
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-accent transition-colors text-sm"
                        >
                          {cliente.nombre}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedCliente && (
                <div className="p-2 bg-primary/10 rounded-md text-sm">
                  <span className="font-medium">Cliente seleccionado:</span> {selectedCliente.nombre}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!selectedCliente || isPending}>
              Crear Pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
