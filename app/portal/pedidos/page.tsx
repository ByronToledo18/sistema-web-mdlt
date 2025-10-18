"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Clock, CheckCircle, XCircle, Truck, ArrowLeft } from "lucide-react"

interface Pedido {
  id: number
  codigo: string
  estado: string
  total: string
  fecha_creacion: string
  created_at: string
}

const estadoConfig: Record<string, { label: string; color: string; icon: any }> = {
  recibido: { label: "Recibido", color: "bg-blue-500", icon: Package },
  en_proceso: { label: "En Proceso", color: "bg-yellow-500", icon: Clock },
  terminado: { label: "Terminado", color: "bg-green-500", icon: CheckCircle },
  entregado: { label: "Entregado", color: "bg-emerald-600", icon: Truck },
  anulado: { label: "Anulado", color: "bg-red-500", icon: XCircle },
}

export default function ClientePedidosPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [clienteId, setClienteId] = useState<number | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/portal/me")
      if (!response.ok) {
        router.push("/portal/login")
        return
      }
      const data = await response.json()
      setClienteId(data.cliente.id)
      fetchPedidos(data.cliente.id)
    } catch (error) {
      console.error("[v0] Auth error:", error)
      router.push("/portal/login")
    }
  }

  const fetchPedidos = async (id: number) => {
    try {
      const response = await fetch(`/api/portal/pedidos?cliente_id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setPedidos(data.pedidos || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching pedidos:", error)
    } finally {
      setLoading(false)
    }
  }

  const pedidosPendientes = pedidos.filter((p) => p.estado !== "entregado" && p.estado !== "anulado")
  const pedidosHistorial = pedidos.filter((p) => p.estado === "entregado" || p.estado === "anulado")

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando pedidos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.push("/catalogo")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Catálogo
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Mis Pedidos</h1>
          <p className="text-muted-foreground mt-2">Consulta el estado de tus pedidos</p>
        </div>

        {/* Pedidos Pendientes */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Pedidos Pendientes</h2>
          {pedidosPendientes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tienes pedidos pendientes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pedidosPendientes.map((pedido) => {
                const config = estadoConfig[pedido.estado]
                const Icon = config.icon
                return (
                  <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-gray-900">{pedido.codigo}</CardTitle>
                        <Badge className={`${config.color} text-white`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Fecha</p>
                          <p className="font-medium text-gray-900">
                            {new Date(pedido.created_at).toLocaleDateString("es-EC")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium text-primary text-lg">${Number(pedido.total).toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Historial de Pedidos */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Historial</h2>
          {pedidosHistorial.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tienes pedidos en el historial</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pedidosHistorial.map((pedido) => {
                const config = estadoConfig[pedido.estado]
                const Icon = config.icon
                return (
                  <Card key={pedido.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-gray-900">{pedido.codigo}</CardTitle>
                        <Badge className={`${config.color} text-white`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Fecha</p>
                          <p className="font-medium text-gray-900">
                            {new Date(pedido.created_at).toLocaleDateString("es-EC")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium text-gray-900">${Number(pedido.total).toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
