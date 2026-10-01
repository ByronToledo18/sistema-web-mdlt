"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { DollarSign } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { pagarServientregaAction } from "@/app/(admin)/admin/envios/actions"
import { formatCurrency } from "@/components/admin/format"

const emptyForm = { monto: "", metodo: "", referencia: "" }

export function PagoServientregaDialog({ cuentaId, saldo }: { cuentaId: number; saldo: number }) {
  const [open, setOpen] = useState(false)
  const [pagoForm, setPagoForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleRegistrarPago = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!pagoForm.monto) {
      setError("El monto es requerido")
      return
    }
    startTransition(async () => {
      const result = await pagarServientregaAction({ cuenta_id: cuentaId, ...pagoForm })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setPagoForm(emptyForm)
      alert("Pago registrado exitosamente")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <DialogDescription>Saldo pendiente: {formatCurrency(saldo)}</DialogDescription>
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
                max={saldo}
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">Máximo: {formatCurrency(saldo)}</p>
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
            <Button type="submit" disabled={isPending}>
              Registrar Pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
