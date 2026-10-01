"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Download, DollarSign, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BackButton } from "@/components/ui/back-button"

interface Pago {
  id: number
  pedido_id: number
  pedido_codigo: string
  cliente_nombre: string
  monto: string
  metodo: string | null
  referencia: string | null
  fecha: string
}

interface Consolidacion {
  total_pagos: number
  cantidad_pagos: number
  total_pedidos: number
  cantidad_pedidos: number
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [consolidacion, setConsolidacion] = useState<Consolidacion | null>(null)
  const [loading, setLoading] = useState(true)

  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  const [reportStartDate, setReportStartDate] = useState("")
  const [reportEndDate, setReportEndDate] = useState("")

  useEffect(() => {
    fetchConsolidacion()
    fetchPagosDelMes()
  }, [selectedYear, selectedMonth])

  const fetchConsolidacion = async () => {
    try {
      const response = await fetch(`/api/pagos/consolidacion?year=${selectedYear}&month=${selectedMonth}`)
      const data = await response.json()

      if (response.ok) {
        setConsolidacion(data.consolidacion)
      }
    } catch (err) {
      console.error("[v0] Error fetching consolidacion:", err)
    }
  }

  const fetchPagosDelMes = async () => {
    try {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString()

      const response = await fetch(`/api/pagos?start_date=${startDate}&end_date=${endDate}`)
      const data = await response.json()

      if (response.ok) {
        setPagos(data.pagos)
      }
    } catch (err) {
      console.error("[v0] Error fetching pagos:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Por favor selecciona ambas fechas")
      return
    }

    try {
      const response = await fetch(
        `/api/pagos/reporte?start_date=${reportStartDate}&end_date=${reportEndDate}&format=csv`,
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `reporte-pagos-${reportStartDate}-${reportEndDate}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error("[v0] Error downloading report:", err)
      alert("Error al descargar el reporte")
    }
  }

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(typeof value === "string" ? Number.parseFloat(value) : value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-EC", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

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
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>Mes</Label>
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(value) => setSelectedMonth(Number.parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1">
                    <Label>Año</Label>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(value) => setSelectedYear(Number.parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {consolidacion && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Recibido</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(consolidacion.total_pagos)}</div>
                    <p className="text-xs text-muted-foreground">
                      {months[selectedMonth - 1]} {selectedYear}
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
            )}

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Cobros</CardTitle>
                <CardDescription>
                  Cobros recibidos en {months[selectedMonth - 1]} {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Cargando cobros...</div>
                ) : pagos.length === 0 ? (
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
                            {formatDate(pago.fecha)}
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
            <Card>
              <CardHeader>
                <CardTitle>Generar Reporte de Cobros</CardTitle>
                <CardDescription>Exporta los cobros de un rango de fechas a CSV</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Fecha de Inicio</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date">Fecha de Fin</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={handleDownloadReport} disabled={!reportStartDate || !reportEndDate} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Reporte CSV
                </Button>
              </CardContent>
            </Card>

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
