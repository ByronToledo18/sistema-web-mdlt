import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Package, TrendingUp } from "lucide-react"
import { neon } from "@neondatabase/serverless"
import AdminLayout from "@/components/admin-layout" // Import AdminLayout

const sql = neon(process.env.DATABASE_URL!)

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const [pedidosActivos, clientesTotales, productosData, ventasData, actividadReciente] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM pedidos WHERE estado IN ('recibido', 'en_proceso')`, // Updated status query to use new status names
    sql`SELECT COUNT(*) as count FROM clientes`,
    sql`SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE stock <= 5) as bajo_stock FROM productos WHERE activo = true`,
    sql`SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE DATE_TRUNC('month', created_at AT TIME ZONE 'America/Guayaquil') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')`,
    sql`
      SELECT 
        'pedido' as tipo,
        p.id,
        'Pedido #' || p.id || ' - ' || c.nombre as descripcion,
        p.created_at AT TIME ZONE 'America/Guayaquil' as fecha
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      UNION ALL
      SELECT 
        'pago' as tipo,
        pg.id,
        'Pago de $' || pg.monto || ' - Pedido #' || pg.pedido_id as descripcion,
        pg.fecha AT TIME ZONE 'America/Guayaquil' as fecha
      FROM pagos pg
      UNION ALL
      SELECT 
        'envio' as tipo,
        e.id,
        'Envío ' || e.guia || ' - Pedido #' || e.pedido_id as descripcion,
        e.created_at AT TIME ZONE 'America/Guayaquil' as fecha
      FROM envios e
      ORDER BY fecha DESC
      LIMIT 5
    `,
  ])

  const pedidosCount = Number(pedidosActivos[0].count)
  const clientesCount = Number(clientesTotales[0].count)
  const productosCount = Number(productosData[0].count)
  const bajoStock = Number(productosData[0].bajo_stock)
  const ventasMes = Number(ventasData[0].total)

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

  const getActivityIcon = (tipo: string) => {
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

          <Card className="border-neutral-200 bg-white shadow-sm animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <CardHeader>
              <CardTitle className="text-neutral-900">Actividad Reciente</CardTitle>
              <CardDescription className="text-neutral-600">Últimas acciones en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {actividadReciente.length > 0 ? (
                  actividadReciente.map((actividad: any, index: number) => {
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
                          <p className="text-xs text-neutral-600">{formatRelativeTime(new Date(actividad.fecha))}</p>
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
