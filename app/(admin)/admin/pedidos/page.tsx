"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye, UserPlus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { BackButton } from "@/components/ui/back-button"

interface Pedido {
  id: number
  codigo: string
  cliente_id: number
  cliente_nombre: string
  cliente_telefono: string | null
  estado: string
  total: string
  fecha_creacion: string
}

interface Cliente {
  id: number
  nombre: string
}

const estadoColors: Record<string, string> = {
  recibido: "bg-blue-500",
  en_proceso: "bg-yellow-500",
  terminado: "bg-green-500",
  anulado: "bg-red-500",
  entregado: "bg-purple-500",
}

const estadoLabels: Record<string, string> = {
  recibido: "Recibido",
  en_proceso: "En Proceso",
  terminado: "Terminado",
  anulado: "Anulado",
  entregado: "Entregado",
}

export default function PedidosPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [clienteSearch, setClienteSearch] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  useEffect(() => {
    fetchClientes()
    fetchPedidos()
  }, [search, estadoFilter])

  const fetchClientes = async () => {
    try {
      const response = await fetch("/api/clientes")
      const data = await response.json()

      if (response.ok && data.clientes) {
        setClientes(data.clientes)
      } else {
        console.error("[v0] Get clientes error:", data.error)
        setClientes([])
      }
    } catch (err) {
      console.error("[v0] Error fetching clientes:", err)
      setClientes([])
    }
  }

  const fetchPedidos = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (estadoFilter !== "todos") params.append("estado", estadoFilter)

      const response = await fetch(`/api/pedidos?${params}`)
      const data = await response.json()

      if (response.ok && data.pedidos) {
        setPedidos(data.pedidos)
      } else {
        console.error("[v0] Get pedidos error:", data.error)
        setPedidos([])
      }
    } catch (err) {
      console.error("[v0] Error fetching pedidos:", err)
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!selectedCliente) {
      setError("Debes seleccionar un cliente")
      return
    }

    try {
      const response = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: selectedCliente.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setDialogOpen(false)
      resetForm()
      fetchPedidos()

      router.push(`/admin/pedidos/${data.pedido.id}`)
    } catch (err) {
      setError("Error al crear pedido")
    }
  }

  const resetForm = () => {
    setSelectedCliente(null)
    setClienteSearch("")
    setError("")
  }

  const filteredClientes = clientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(clienteSearch.toLowerCase()),
  )

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(Number.parseFloat(value))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-EC", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Pedidos</h1>
              <p className="text-muted-foreground">Gestión y seguimiento de pedidos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                      Crea un nuevo pedido. El código se generará automáticamente y el estado inicial será "Recibido".
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
                          placeholder="Buscar cliente por nombre..."
                          value={clienteSearch}
                          onChange={(e) => {
                            setClienteSearch(e.target.value)
                            setSelectedCliente(null)
                          }}
                          className="pl-10"
                        />
                        {clienteSearch && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredClientes.length === 0 ? (
                              <div className="p-3 text-sm text-muted-foreground text-center">
                                No se encontraron coincidencias
                              </div>
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
                    <Button type="submit" disabled={!selectedCliente}>
                      Crear Pedido
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="recibido">Recibido</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="terminado">Terminado</SelectItem>
              <SelectItem value="anulado">Anulado</SelectItem>
              <SelectItem value="entregado">Entregado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando pedidos...</div>
        ) : pedidos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron pedidos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pedidos.map((pedido) => (
              <Card key={pedido.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{pedido.codigo}</CardTitle>
                      <CardDescription>
                        {pedido.cliente_nombre}
                        {pedido.cliente_telefono && ` • ${pedido.cliente_telefono}`}
                      </CardDescription>
                    </div>
                    <Badge className={estadoColors[pedido.estado]}>{estadoLabels[pedido.estado]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{formatCurrency(pedido.total)}</p>
                      <p className="text-sm text-muted-foreground">Creado: {formatDate(pedido.fecha_creacion)}</p>
                    </div>
                    <Button variant="outline" onClick={() => router.push(`/admin/pedidos/${pedido.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
