"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Plus, DollarSign, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"

interface NominaMov {
  id: number
  persona_tipo: string
  pedido_id: number | null
  pedido_codigo: string | null
  concepto: string
  monto: string
  fecha: string
  tipo: "pago" | "deduccion" | "bono"
}

interface Consolidado {
  persona_tipo: string
  movimientos: number
  total_pagado: string
  total_deducido: string
}

const personaTipoLabels: Record<string, string> = {
  emprendedora: "Emprendedora",
  madre: "Madre de la Emprendedora",
  costurera_externa: "Costurera Externa",
  otro: "Otro",
}

const tipoColors: Record<string, string> = {
  pago: "bg-green-500",
  bono: "bg-blue-500",
  deduccion: "bg-red-500",
}

export default function NominaPage() {
  const [movimientos, setMovimientos] = useState<NominaMov[]>([])
  const [consolidado, setConsolidado] = useState<Consolidado[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState("")

  const [filtroPersonaTipo, setFiltroPersonaTipo] = useState<string>("todos")

  const [form, setForm] = useState({
    persona_tipo: "",
    persona_nombre: "",
    concepto: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    tipo: "pago" as "pago" | "deduccion" | "bono",
  })

  useEffect(() => {
    fetchMovimientos()
    fetchConsolidado()
  }, [filtroPersonaTipo])

  const fetchMovimientos = async () => {
    try {
      const params = new URLSearchParams()
      if (filtroPersonaTipo !== "todos") params.append("persona_tipo", filtroPersonaTipo)

      const response = await fetch(`/api/nomina?${params}`)
      const data = await response.json()

      if (response.ok) setMovimientos(data.movimientos)
    } catch (err) {
      console.error("[v0] Error fetching nomina:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchConsolidado = async () => {
    try {
      const response = await fetch("/api/nomina?vista=consolidado")
      const data = await response.json()

      if (response.ok) setConsolidado(data.consolidado)
    } catch (err) {
      console.error("[v0] Error fetching consolidado nomina:", err)
    }
  }

  const resetForm = () => {
    setForm({
      persona_tipo: "",
      persona_nombre: "",
      concepto: "",
      monto: "",
      fecha: new Date().toISOString().split("T")[0],
      tipo: "pago",
    })
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.persona_tipo || !form.persona_nombre || !form.concepto || !form.monto) {
      setError("Todos los campos son requeridos")
      return
    }

    try {
      const response = await fetch("/api/nomina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_tipo: form.persona_tipo,
          concepto: `${form.persona_nombre}: ${form.concepto}`,
          monto: Number.parseFloat(form.monto),
          fecha: form.fecha,
          tipo: form.tipo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setDialogOpen(false)
      resetForm()
      fetchMovimientos()
      fetchConsolidado()
    } catch (err) {
      setError("Error al registrar el movimiento")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este movimiento de nómina?")) return

    try {
      const response = await fetch(`/api/nomina/${id}`, { method: "DELETE" })
      if (response.ok) {
        fetchMovimientos()
        fetchConsolidado()
      }
    } catch (err) {
      console.error("[v0] Error deleting nomina movimiento:", err)
    }
  }

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(typeof value === "string" ? Number.parseFloat(value) : value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Nómina</h1>
              <p className="text-muted-foreground">Registro manual de pagos a personas</p>
            </div>
          </div>

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
                Registrar Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Registrar Movimiento de Nómina</DialogTitle>
                  <DialogDescription>Pago, bono o deducción a una persona</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="persona-tipo">Persona *</Label>
                      <Select
                        value={form.persona_tipo}
                        onValueChange={(value) => setForm({ ...form, persona_tipo: value })}
                      >
                        <SelectTrigger id="persona-tipo">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emprendedora">Emprendedora</SelectItem>
                          <SelectItem value="madre">Madre de la Emprendedora</SelectItem>
                          <SelectItem value="costurera_externa">Costurera Externa</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo *</Label>
                      <Select
                        value={form.tipo}
                        onValueChange={(value) => setForm({ ...form, tipo: value as "pago" | "deduccion" | "bono" })}
                      >
                        <SelectTrigger id="tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="bono">Bono</SelectItem>
                          <SelectItem value="deduccion">Deducción</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="persona-nombre">Nombre de la Persona *</Label>
                    <Input
                      id="persona-nombre"
                      value={form.persona_nombre}
                      onChange={(e) => setForm({ ...form, persona_nombre: e.target.value })}
                      placeholder="Nombre completo"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="concepto">Concepto *</Label>
                    <Input
                      id="concepto"
                      value={form.concepto}
                      onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                      placeholder="Ej: Confección de 3 tutús, semana del 24 al 28"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="monto">Monto *</Label>
                      <Input
                        id="monto"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.monto}
                        onChange={(e) => setForm({ ...form, monto: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fecha">Fecha *</Label>
                      <Input
                        id="fecha"
                        type="date"
                        value={form.fecha}
                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit">Registrar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {consolidado.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {consolidado.map((c) => (
              <Card key={c.persona_tipo}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {personaTipoLabels[c.persona_tipo] || c.persona_tipo}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Number(c.total_pagado) - Number(c.total_deducido))}</div>
                  <p className="text-xs text-muted-foreground">{c.movimientos} movimiento(s)</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Movimientos</CardTitle>
                <CardDescription>Historial de pagos, bonos y deducciones</CardDescription>
              </div>
              <div className="w-56">
                <Select value={filtroPersonaTipo} onValueChange={setFiltroPersonaTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas las personas</SelectItem>
                    <SelectItem value="emprendedora">Emprendedora</SelectItem>
                    <SelectItem value="madre">Madre de la Emprendedora</SelectItem>
                    <SelectItem value="costurera_externa">Costurera Externa</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando movimientos...</div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay movimientos registrados</div>
            ) : (
              <div className="space-y-2">
                {movimientos.map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={tipoColors[mov.tipo]}>{mov.tipo}</Badge>
                        <Badge variant="outline">{personaTipoLabels[mov.persona_tipo] || mov.persona_tipo}</Badge>
                        {mov.pedido_codigo && <Badge variant="secondary">{mov.pedido_codigo}</Badge>}
                      </div>
                      <p className="text-sm">{mov.concepto}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(mov.fecha)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={`font-bold text-lg ${mov.tipo === "deduccion" ? "text-red-600" : "text-green-600"}`}>
                        {mov.tipo === "deduccion" ? "-" : "+"}
                        {formatCurrency(mov.monto)}
                      </p>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(mov.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
