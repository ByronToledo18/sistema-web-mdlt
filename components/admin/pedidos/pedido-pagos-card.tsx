"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { DollarSign, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { eliminarPagoAction, registrarPagoAction } from "@/app/(admin)/admin/pedidos/actions"
import { formatCurrency, formatDateTime } from "@/components/admin/format"
import type { PagoPedido } from "./types"

interface PedidoPagosCardProps {
  pedidoId: number
  pagos: PagoPedido[]
  saldoPendiente: number
  canModifyOrder: boolean
  canDeletePago: boolean
}

const emptyForm = { monto: "", metodo: "", referencia: "", observacion: "" }

export function PedidoPagosCard({ pedidoId, pagos, saldoPendiente, canModifyOrder, canDeletePago }: PedidoPagosCardProps) {
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [pagoForm, setPagoForm] = useState(emptyForm)
  const [pagoError, setPagoError] = useState("")
  const [isPending, startTransition] = useTransition()

  const resetPagoForm = () => {
    setPagoForm(emptyForm)
    setPagoError("")
  }

  const handleSubmitPago = (e: React.FormEvent) => {
    e.preventDefault()
    setPagoError("")

    if (!pagoForm.monto) {
      setPagoError("El monto es requerido")
      return
    }

    startTransition(async () => {
      const result = await registrarPagoAction({ pedido_id: pedidoId, ...pagoForm })
      if (!result.ok) {
        setPagoError(result.error)
        return
      }
      setPagoDialogOpen(false)
      resetPagoForm()
    })
  }

  const handleDeletePago = (pagoId: number) => {
    if (!confirm("¿Estás seguro de eliminar este pago?")) return
    startTransition(async () => {
      const result = await eliminarPagoAction(pagoId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pagos Recibidos</CardTitle>
            <CardDescription>
              {pagos.length === 0 ? "No hay pagos registrados" : `${pagos.length} pago(s) registrado(s)`}
            </CardDescription>
          </div>
          <Dialog
            open={pagoDialogOpen}
            onOpenChange={(open) => {
              setPagoDialogOpen(open)
              if (!open) resetPagoForm()
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={saldoPendiente <= 0 || !canModifyOrder}>
                <DollarSign className="mr-2 h-4 w-4" />
                Registrar Pago
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmitPago}>
                <DialogHeader>
                  <DialogTitle>Registrar Pago</DialogTitle>
                  <DialogDescription>
                    Registra un pago recibido para este pedido. Saldo pendiente: {formatCurrency(saldoPendiente)}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {pagoError && (
                    <Alert variant="destructive">
                      <AlertDescription>{pagoError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="monto">Monto *</Label>
                    <Input
                      id="monto"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={saldoPendiente}
                      value={pagoForm.monto}
                      onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Máximo: {formatCurrency(saldoPendiente)}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metodo">Método de Pago</Label>
                    <Select value={pagoForm.metodo} onValueChange={(value) => setPagoForm({ ...pagoForm, metodo: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referencia">Referencia</Label>
                    <Input
                      id="referencia"
                      value={pagoForm.referencia}
                      onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                      placeholder="Número de transacción, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacion">Observación</Label>
                    <Textarea
                      id="observacion"
                      value={pagoForm.observacion}
                      onChange={(e) => setPagoForm({ ...pagoForm, observacion: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    Registrar Pago
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {pagos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay pagos registrados para este pedido.</p>
            <p className="text-sm mt-2">Haz clic en "Registrar Pago" para agregar uno.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pagos.map((pago) => (
              <div key={pago.id} className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-lg text-green-600">{formatCurrency(pago.monto)}</p>
                    {pago.metodo && <Badge variant="outline">{pago.metodo}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(pago.fecha)}
                    {pago.referencia && ` • Ref: ${pago.referencia}`}
                  </p>
                  {pago.observacion && <p className="text-sm mt-1 italic">{pago.observacion}</p>}
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeletePago(pago.id)}
                  disabled={!canModifyOrder || !canDeletePago || isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
