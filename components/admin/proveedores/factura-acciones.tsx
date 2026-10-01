"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { AlertCircle, DollarSign } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { anularFacturaProveedorAction, pagarFacturaProveedorAction } from "@/app/(admin)/admin/proveedores/actions"
import { formatCurrency } from "@/components/admin/format"

interface FacturaAccionesProps {
  factura: { id: number; numero_factura: string; saldo: string }
}

const emptyPago = { monto: "", metodo: "", referencia: "", observacion: "" }

// Botones "Registrar Pago" y "Anular" de una factura pendiente.
export function FacturaAcciones({ factura }: FacturaAccionesProps) {
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [pagoData, setPagoData] = useState(emptyPago)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const resetPagoForm = () => {
    setPagoData(emptyPago)
    setError("")
  }

  const handlePago = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const result = await pagarFacturaProveedorAction(factura.id, pagoData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPagoDialogOpen(false)
      resetPagoForm()
    })
  }

  const handleAnular = () => {
    if (!confirm("¿Estás seguro de anular esta factura? Esto revertirá el stock agregado.")) return
    startTransition(async () => {
      const result = await anularFacturaProveedorAction(factura.id)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <>
      <div className="flex gap-2 mt-4">
        <Button variant="default" size="sm" onClick={() => setPagoDialogOpen(true)}>
          <DollarSign className="mr-2 h-3 w-3" />
          Registrar Pago
        </Button>
        <Button variant="destructive" size="sm" onClick={handleAnular} disabled={isPending}>
          <AlertCircle className="mr-2 h-3 w-3" />
          Anular
        </Button>
      </div>

      <Dialog
        open={pagoDialogOpen}
        onOpenChange={(open) => {
          setPagoDialogOpen(open)
          if (!open) resetPagoForm()
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handlePago}>
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>Factura: {factura.numero_factura}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Saldo pendiente:</p>
                    <p className="text-2xl font-bold">{formatCurrency(factura.saldo)}</p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor={`monto-${factura.id}`}>Monto *</Label>
                <Input
                  id={`monto-${factura.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  max={factura.saldo}
                  value={pagoData.monto}
                  onChange={(e) => setPagoData({ ...pagoData, monto: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`metodo-${factura.id}`}>Método de Pago</Label>
                <Input
                  id={`metodo-${factura.id}`}
                  value={pagoData.metodo}
                  onChange={(e) => setPagoData({ ...pagoData, metodo: e.target.value })}
                  placeholder="Transferencia, Efectivo, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`referencia-${factura.id}`}>Referencia</Label>
                <Input
                  id={`referencia-${factura.id}`}
                  value={pagoData.referencia}
                  onChange={(e) => setPagoData({ ...pagoData, referencia: e.target.value })}
                  placeholder="Número de transacción"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`observacion-${factura.id}`}>Observación</Label>
                <Textarea
                  id={`observacion-${factura.id}`}
                  value={pagoData.observacion}
                  onChange={(e) => setPagoData({ ...pagoData, observacion: e.target.value })}
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
    </>
  )
}
