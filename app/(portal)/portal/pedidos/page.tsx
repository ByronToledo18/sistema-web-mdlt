import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Clock, CheckCircle, XCircle, Truck, ArrowLeft } from "lucide-react"
import { requireCliente } from "@/server/auth/session"
import { listarPedidosDeCliente } from "@/server/services/pedidos"

const estadoConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  recibido: { label: "Recibido", color: "bg-blue-500", icon: Package },
  en_proceso: { label: "En Proceso", color: "bg-yellow-500", icon: Clock },
  terminado: { label: "Terminado", color: "bg-green-500", icon: CheckCircle },
  entregado: { label: "Entregado", color: "bg-emerald-600", icon: Truck },
  anulado: { label: "Anulado", color: "bg-red-500", icon: XCircle },
}

// La fecha se renderiza en el servidor (UTC en Vercel): se fija la zona de
// la tienda para que coincida con lo que mostraba el navegador.
function fecha(valor: Date | null) {
  return valor ? valor.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" }) : ""
}

// Server Component: la sesión y los pedidos se leen en el servidor, sin
// fetch en cascada desde el navegador.
export default async function ClientePedidosPage() {
  const cliente = await requireCliente()
  const pedidos = await listarPedidosDeCliente(cliente.id)

  const pedidosPendientes = pedidos.filter((p) => p.estado !== "entregado" && p.estado !== "anulado")
  const pedidosHistorial = pedidos.filter((p) => p.estado === "entregado" || p.estado === "anulado")

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Button variant="outline" className="mb-4" asChild>
            <Link href="/catalogo">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Catálogo
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Mis Pedidos</h1>
          <p className="text-muted-foreground mt-2">Consulta el estado de tus pedidos</p>
        </div>

        {/* Pedidos Pendientes */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Pedidos Pendientes</h2>
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
                const config = estadoConfig[pedido.estado ?? ""]
                const Icon = config.icon
                return (
                  <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-foreground">{pedido.codigo}</CardTitle>
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
                          <p className="font-medium text-foreground">
                            {fecha(pedido.created_at)}
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
          <h2 className="text-2xl font-semibold text-foreground mb-4">Historial</h2>
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
                const config = estadoConfig[pedido.estado ?? ""]
                const Icon = config.icon
                return (
                  <Card key={pedido.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-foreground">{pedido.codigo}</CardTitle>
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
                          <p className="font-medium text-foreground">
                            {fecha(pedido.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium text-foreground">${Number(pedido.total).toFixed(2)}</p>
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
