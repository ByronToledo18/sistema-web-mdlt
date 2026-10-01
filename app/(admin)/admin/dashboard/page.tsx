import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Package, TrendingUp } from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { requireUser } from "@/server/auth/session"
import { PedidosPorEstadoChart } from "@/components/admin/dashboard/pedidos-por-estado-chart"
import { VentasPorMesChart } from "@/components/admin/dashboard/ventas-por-mes-chart"
import { pedidosPorEstado, resumenDashboard, ventasPorMes, type TipoActividad } from "@/server/services/dashboard"

export default async function DashboardPage() {
  const user = await requireUser()
  const [resumen, ventas, estados] = await Promise.all([resumenDashboard(), ventasPorMes(12), pedidosPorEstado()])

  const pedidosCount = resumen.pedidosActivos
  const clientesCount = resumen.clientesTotales
  const productosCount = resumen.productos
  const bajoStock = resumen.bajoStock
  const ventasMes = resumen.ventasMes
  const actividadReciente = resumen.actividad

  // Calculate month-over-month growth (simplified - you can enhance this)
  const stats = [
    {
      title: "Pedidos Activos",
      value: pedidosCount.toString(),
      description: "Pedidos en proceso",
      icon: ShoppingCart,
      trend: "up",
    },
    {
      title: "Clientes Totales",
      value: clientesCount.toString(),
      description: "Clientes registrados",
      icon: Users,
      trend: "up",
    },
    {
      title: "Productos",
      value: productosCount.toString(),
      description: bajoStock > 0 ? `⚠️ ${bajoStock} con stock bajo` : "Stock normal",
      icon: Package,
      trend: bajoStock > 0 ? "down" : "up",
    },
    {
      title: "Ventas del Mes",
      value: `$${ventasMes.toFixed(2)}`,
      description: "Total del mes actual",
      icon: TrendingUp,
      trend: "up",
    },
  ]

  // Format relative time in Spanish
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Hace un momento"
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? "s" : ""}`
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`
    return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`
  }

  const getActivityIcon = (tipo: TipoActividad) => {
    switch (tipo) {
      case "pedido":
        return ShoppingCart
      case "pago":
        return TrendingUp
      case "envio":
        return Package
      default:
        return ShoppingCart
    }
  }

  return (
    <AdminLayout userName={user.nombre} userRole={user.rol}>
      <div className="p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="animate-fade-in-up">
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
            <p className="text-neutral-600 text-lg mt-1">Bienvenido de nuevo, {user.nombre}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <Card
                  key={stat.title}
                  className={`card-hover border-neutral-200 bg-white shadow-sm animate-fade-in-up ${
                    stat.title === "Productos" && bajoStock > 0 ? "border-amber-500 border-2" : ""
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-700">{stat.title}</CardTitle>
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-all group ${
                        stat.title === "Productos" && bajoStock > 0
                          ? "bg-amber-100 hover:bg-amber-500"
                          : "bg-neutral-100 hover:bg-neutral-900"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 transition-colors ${
                          stat.title === "Productos" && bajoStock > 0
                            ? "text-amber-700 group-hover:text-white"
                            : "text-neutral-700 group-hover:text-white"
                        }`}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-neutral-900">{stat.value}</div>
                    <p
                      className={`text-xs mt-1 ${
                        stat.title === "Productos" && bajoStock > 0 ? "text-amber-700 font-medium" : "text-neutral-600"
                      }`}
                    >
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              className="border-neutral-200 bg-white shadow-sm animate-fade-in-up lg:col-span-2"
              style={{ animationDelay: "0.4s" }}
            >
              <CardHeader>
                <CardTitle className="text-neutral-900">Ventas por Mes</CardTitle>
                <CardDescription className="text-neutral-600">Últimos 12 meses, sin pedidos anulados</CardDescription>
              </CardHeader>
              <CardContent>
                <VentasPorMesChart data={ventas} />
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white shadow-sm animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
              <CardHeader>
                <CardTitle className="text-neutral-900">Pedidos por Estado</CardTitle>
                <CardDescription className="text-neutral-600">Todos los pedidos registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <PedidosPorEstadoChart data={estados} />
              </CardContent>
            </Card>
          </div>

          <Card className="border-neutral-200 bg-white shadow-sm animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <CardHeader>
              <CardTitle className="text-neutral-900">Actividad Reciente</CardTitle>
              <CardDescription className="text-neutral-600">Últimas acciones en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {actividadReciente.length > 0 ? (
                  actividadReciente.map((actividad, index) => {
                    const Icon = getActivityIcon(actividad.tipo)
                    return (
                      <div
                        key={`${actividad.tipo}-${actividad.id}-${index}`}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900">{actividad.descripcion}</p>
                          <p className="text-xs text-neutral-600">{formatRelativeTime(actividad.fecha)}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-neutral-600 text-center py-4">No hay actividad reciente</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
