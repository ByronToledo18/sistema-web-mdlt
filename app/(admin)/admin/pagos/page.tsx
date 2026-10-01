import { Calendar, Download, DollarSign, TrendingUp } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency, formatDateTime, MESES } from "@/components/admin/format"
import { ReporteCobros } from "@/components/admin/pagos/reporte-cobros"
import { PeriodoSelector } from "@/components/admin/periodo-selector"
import { requirePermission } from "@/server/auth/session"
import { consolidacionMensual, mesEnDias, pagosPorRango } from "@/server/services/pagos"
import { periodoQuery } from "@/server/validators/pagos"

type SearchParams = Promise<{ year?: string; month?: string }>

export default async function PagosPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("cobros")
  const parsed = periodoQuery.safeParse(await searchParams)
  const { year, month } = parsed.success ? parsed.data : periodoQuery.parse({})

  // Antes se pedía /api/pagos con start_date/end_date, pero la API ignoraba
  // esos parámetros y el detalle mostraba los cobros de todos los meses.
  const [consolidacion, pagos] = await Promise.all([
    consolidacionMensual(year, month),
    pagosPorRango(...mesEnDias(year, month)),
  ])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Cobros</h1>
              <p className="text-muted-foreground">Gestión y consolidación de cobros recibidos</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="consolidacion" className="space-y-4">
          <TabsList>
            <TabsTrigger value="consolidacion">
              <TrendingUp className="mr-2 h-4 w-4" />
              Consolidación Mensual
            </TabsTrigger>
            <TabsTrigger value="reportes">
              <Download className="mr-2 h-4 w-4" />
              Reportes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consolidacion" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Período</CardTitle>
                <CardDescription>Elige el mes y año para ver la consolidación</CardDescription>
              </CardHeader>
              <CardContent>
                <PeriodoSelector year={year} month={month} />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Recibido</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(consolidacion.total_pagos)}</div>
                  <p className="text-xs text-muted-foreground">
                    {MESES[month - 1]} {year}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cantidad de Cobros</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{consolidacion.cantidad_pagos}</div>
                  <p className="text-xs text-muted-foreground">Transacciones registradas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(consolidacion.total_pedidos)}</div>
                  <p className="text-xs text-muted-foreground">Valor total de pedidos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pedidos Activos</CardTitle>
                  <Badge variant="outline">{consolidacion.cantidad_pedidos}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{consolidacion.cantidad_pedidos}</div>
                  <p className="text-xs text-muted-foreground">Con cobros en el período</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Cobros</CardTitle>
                <CardDescription>
                  Cobros recibidos en {MESES[month - 1]} {year}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pagos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay cobros registrados en este período
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pagos.map((pago) => (
                      <div key={pago.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{pago.pedido_codigo}</p>
                            <Badge variant="outline" className="text-xs">
                              {pago.cliente_nombre}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(pago.fecha, "short")}
                            {pago.metodo && ` • ${pago.metodo}`}
                            {pago.referencia && ` • Ref: ${pago.referencia}`}
                          </p>
                        </div>
                        <p className="font-bold text-lg text-green-600">{formatCurrency(pago.monto)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reportes" className="space-y-4">
            <ReporteCobros />

            <Card>
              <CardHeader>
                <CardTitle>Información del Reporte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>El reporte incluye:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>ID del pago</li>
                  <li>Fecha y hora del pago</li>
                  <li>Código del pedido</li>
                  <li>Nombre del cliente</li>
                  <li>Monto pagado</li>
                  <li>Método de pago</li>
                  <li>Referencia de pago</li>
                </ul>
                <p className="pt-2">El archivo se descargará en formato CSV compatible con Excel y Google Sheets.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
