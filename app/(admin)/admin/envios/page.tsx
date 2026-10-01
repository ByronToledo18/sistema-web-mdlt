import { Calendar, DollarSign, Package, Truck } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PagoServientregaDialog } from "@/components/admin/envios/pago-servientrega-dialog"
import { RegistrarGuiaButton } from "@/components/admin/envios/registrar-guia-button"
import { formatCurrency, formatDate, MESES } from "@/components/admin/format"
import { Paginacion } from "@/components/admin/paginacion"
import { PeriodoSelector } from "@/components/admin/periodo-selector"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { consolidacionServientrega, paginaDeEnvios } from "@/server/services/envios"
import { numeroDePagina } from "@/server/validators/common"
import { periodoQuery } from "@/server/validators/pagos"

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-500",
  en_proceso: "bg-blue-500",
  enviado: "bg-blue-500",
  terminado: "bg-green-500",
  anulado: "bg-red-500",
}

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  enviado: "Enviado",
  terminado: "Terminado",
  anulado: "Anulado",
}

type SearchParams = Promise<{ year?: string; month?: string; page?: string }>

export default async function EnviosPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("envios")
  const params = await searchParams
  const parsed = periodoQuery.safeParse(params)
  const { year, month } = parsed.success ? parsed.data : periodoQuery.parse({})

  const canSeeCuenta = can(user, "servientrega", "read")
  const [{ filas: envios, pagina, haySiguiente }, consolidacion] = await Promise.all([
    paginaDeEnvios(numeroDePagina(params.page)),
    canSeeCuenta ? consolidacionServientrega(year, month) : null,
  ])
  const canUpdateEnvio = can(user, "envios", "update")
  const canPayCuenta = can(user, "servientrega", "update")

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Envíos</h1>
              <p className="text-muted-foreground">Gestión de envíos y cuenta Servientrega</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="envios" className="space-y-4">
          <TabsList>
            <TabsTrigger value="envios">
              <Package className="mr-2 h-4 w-4" />
              Envíos
            </TabsTrigger>
            {consolidacion && (
              <TabsTrigger value="servientrega">
                <Truck className="mr-2 h-4 w-4" />
                Cuenta Servientrega
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="envios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Envíos</CardTitle>
                <CardDescription>Todos los envíos registrados en el sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {envios.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay envíos registrados. Los envíos se crean desde la página de cada pedido.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {envios.map((envio) => (
                      <div key={envio.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{envio.guia}</p>
                            <Badge variant="outline">{envio.pedido_codigo}</Badge>
                            <Badge className={estadoColors[envio.estado ?? ""]}>{estadoLabels[envio.estado ?? ""]}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {envio.cliente_nombre} • {formatDate(envio.fecha_envio, "short")}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Costo</p>
                            <p className="font-bold">{formatCurrency(envio.costo)}</p>
                          </div>
                          {envio.estado === "pendiente" || envio.estado === "en_proceso" ? (
                            canUpdateEnvio && <RegistrarGuiaButton envio={{ id: envio.id, guia: envio.guia }} />
                          ) : (
                            <Badge variant="secondary" className="px-3 py-1">
                              Guía Generada
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Paginacion pagina={pagina} haySiguiente={haySiguiente} />
              </CardContent>
            </Card>
          </TabsContent>

          {consolidacion && (
            <TabsContent value="servientrega" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Seleccionar Período</CardTitle>
                  <CardDescription>Elige el mes y año para ver la cuenta de Servientrega</CardDescription>
                </CardHeader>
                <CardContent>
                  <PeriodoSelector year={year} month={month} />
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cargos</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(consolidacion.cuenta.total_cargos)}</div>
                    <p className="text-xs text-muted-foreground">
                      {MESES[month - 1]} {year}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(consolidacion.cuenta.total_pagado)}
                    </div>
                    <p className="text-xs text-muted-foreground">Pagos realizados</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Pendiente</CardTitle>
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${consolidacion.cuenta.saldo > 0 ? "text-orange-600" : "text-green-600"}`}
                    >
                      {formatCurrency(consolidacion.cuenta.saldo)}
                    </div>
                    <p className="text-xs text-muted-foreground">Por pagar</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Envíos</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{consolidacion.detalles.length}</div>
                    <p className="text-xs text-muted-foreground">En este período</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Detalle de Envíos</CardTitle>
                      <CardDescription>
                        Envíos incluidos en la cuenta de {MESES[month - 1]} {year}
                      </CardDescription>
                    </div>
                    {consolidacion.cuenta.saldo > 0 && canPayCuenta && (
                      <PagoServientregaDialog cuentaId={consolidacion.cuenta.id} saldo={consolidacion.cuenta.saldo} />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {consolidacion.detalles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay envíos en este período. Agrega envíos desde la pestaña &quot;Envíos&quot;.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {consolidacion.detalles.map((detalle) => (
                        <div key={detalle.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{detalle.guia}</p>
                              <Badge variant="outline">{detalle.pedido_codigo}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{formatDate(detalle.fecha_envio, "short")}</p>
                          </div>
                          <p className="font-bold text-lg">{formatCurrency(detalle.monto)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
