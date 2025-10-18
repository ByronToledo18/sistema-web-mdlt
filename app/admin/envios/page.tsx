"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Package, Truck, DollarSign, Calendar, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"

interface Envio {
  id: number
  pedido_id: number
  pedido_codigo: string
  cliente_nombre: string
  guia: string
  fecha_envio: string
  estado: string
  costo: string
}

interface ConsolidacionServientrega {
  cuenta: {
    id: number
    periodo: string
    total_cargos: number
    total_pagado: number
    saldo: number
  }
  detalles: Array<{
    id: number
    envio_id: number
    monto: string
    guia: string
    pedido_codigo: string
    fecha_envio: string
  }>
}

export default function EnviosPage() {
  const [envios, setEnvios] = useState<Envio[]>([])
  const [consolidacion, setConsolidacion] = useState<ConsolidacionServientrega | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [userRole, setUserRole] = useState<string>("")

  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  const [pagoForm, setPagoForm] = useState({
    monto: "",
    metodo: "",
    referencia: "",
  })

  useEffect(() => {
    fetchEnvios()
    fetchUserRole()
  }, [])

  useEffect(() => {
    fetchConsolidacion()
  }, [selectedYear, selectedMonth])

  const fetchEnvios = async () => {
    try {
      const response = await fetch("/api/envios")
      const data = await response.json()

      if (response.ok) {
        setEnvios(data.envios)
      }
    } catch (err) {
      console.error("[v0] Error fetching envios:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchConsolidacion = async () => {
    try {
      const response = await fetch(`/api/servientrega/consolidacion?year=${selectedYear}&month=${selectedMonth}`)
      const data = await response.json()

      if (response.ok) {
        setConsolidacion(data)
      }
    } catch (err) {
      console.error("[v0] Error fetching consolidacion:", err)
    }
  }

  const fetchUserRole = async () => {
    try {
      const response = await fetch("/api/auth/me")
      const data = await response.json()
      if (response.ok) {
        setUserRole(data.user.rol)
      }
    } catch (err) {
      console.error("[v0] Error fetching user role:", err)
    }
  }

  const handleGenerarGuia = async (envioId: number) => {
    try {
      // TODO: Integrate with Servientrega API to generate real shipping guide
      // For now, simulate successful guide generation

      const response = await fetch(`/api/envios/${envioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "en_proceso",
        }),
      })

      if (response.ok) {
        fetchEnvios()
        fetchConsolidacion()
        alert("Guía generada exitosamente. El costo ha sido agregado a la cuenta de Servientrega.")
      } else {
        alert("Error al generar la guía")
      }
    } catch (err) {
      console.error("[v0] Error generating guide:", err)
      alert("Error al generar la guía")
    }
  }

  const handleAgregarACuenta = async (envioId: number) => {
    try {
      const response = await fetch("/api/servientrega/consolidacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envio_id: envioId,
          year: selectedYear,
          month: selectedMonth,
        }),
      })

      if (response.ok) {
        fetchConsolidacion()
        alert("Envío agregado a la cuenta de Servientrega")
      }
    } catch (err) {
      console.error("[v0] Error adding to cuenta:", err)
      alert("Error al agregar envío a la cuenta")
    }
  }

  const handleRegistrarPago = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!consolidacion || !pagoForm.monto) {
      setError("El monto es requerido")
      return
    }

    try {
      const response = await fetch("/api/servientrega/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_id: consolidacion.cuenta.id,
          monto: Number.parseFloat(pagoForm.monto),
          metodo: pagoForm.metodo || null,
          referencia: pagoForm.referencia || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setPagoDialogOpen(false)
      setPagoForm({ monto: "", metodo: "", referencia: "" })
      fetchConsolidacion()
      alert("Pago registrado exitosamente")
    } catch (err) {
      setError("Error al registrar pago")
    }
  }

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(typeof value === "string" ? Number.parseFloat(value) : value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-EC", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

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
            <TabsTrigger value="servientrega">
              <Truck className="mr-2 h-4 w-4" />
              Cuenta Servientrega
            </TabsTrigger>
          </TabsList>

          <TabsContent value="envios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Envíos</CardTitle>
                <CardDescription>Todos los envíos registrados en el sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Cargando envíos...</div>
                ) : envios.length === 0 ? (
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
                            <Badge className={estadoColors[envio.estado]}>{estadoLabels[envio.estado]}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {envio.cliente_nombre} • {formatDate(envio.fecha_envio)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Costo</p>
                            <p className="font-bold">{formatCurrency(envio.costo)}</p>
                          </div>
                          {["pendiente", "en_proceso"].includes(envio.estado) ? (
                            <Button variant="default" size="sm" onClick={() => handleGenerarGuia(envio.id)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Generar Guía
                            </Button>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servientrega" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Período</CardTitle>
                <CardDescription>Elige el mes y año para ver la cuenta de Servientrega</CardDescription>
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
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Cargos</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(consolidacion.cuenta.total_cargos)}</div>
                      <p className="text-xs text-muted-foreground">
                        {months[selectedMonth - 1]} {selectedYear}
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
                          Envíos incluidos en la cuenta de {months[selectedMonth - 1]} {selectedYear}
                        </CardDescription>
                      </div>
                      {consolidacion.cuenta.saldo > 0 && userRole === "administrador" && (
                        <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
                          <DialogTrigger asChild>
                            <Button>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Registrar Pago
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <form onSubmit={handleRegistrarPago}>
                              <DialogHeader>
                                <DialogTitle>Registrar Pago a Servientrega</DialogTitle>
                                <DialogDescription>
                                  Saldo pendiente: {formatCurrency(consolidacion.cuenta.saldo)}
                                </DialogDescription>
                              </DialogHeader>

                              <div className="grid gap-4 py-4">
                                {error && (
                                  <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                  </Alert>
                                )}

                                <div className="space-y-2">
                                  <Label htmlFor="monto">Monto a Pagar *</Label>
                                  <Input
                                    id="monto"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={consolidacion.cuenta.saldo}
                                    value={pagoForm.monto}
                                    onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                                    required
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Máximo: {formatCurrency(consolidacion.cuenta.saldo)}
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="metodo">Medio de Pago *</Label>
                                  <Select
                                    value={pagoForm.metodo}
                                    onValueChange={(value) => setPagoForm({ ...pagoForm, metodo: value })}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona un método" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="efectivo">Efectivo</SelectItem>
                                      <SelectItem value="transferencia">Transferencia</SelectItem>
                                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                                      <SelectItem value="cheque">Cheque</SelectItem>
                                      <SelectItem value="otro">Otro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="referencia">Referencia *</Label>
                                  <Input
                                    id="referencia"
                                    value={pagoForm.referencia}
                                    onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                                    placeholder="Número de transacción, cheque, etc."
                                    required
                                  />
                                </div>
                              </div>

                              <DialogFooter>
                                <Button type="submit">Registrar Pago</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {consolidacion.detalles.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay envíos en este período. Agrega envíos desde la pestaña "Envíos".
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
                              <p className="text-sm text-muted-foreground">{formatDate(detalle.fecha_envio)}</p>
                            </div>
                            <p className="font-bold text-lg">{formatCurrency(detalle.monto)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
