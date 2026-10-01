"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { FileText } from "lucide-react"
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
import { registrarGuiaAction } from "@/app/(admin)/admin/envios/actions"

// Servientrega no tiene una API de autoservicio (requiere credenciales
// corporativas solicitadas directamente a Servientrega). Hasta tenerlas, el
// admin genera la guía en el portal de Servientrega y la registra aquí.
export function RegistrarGuiaButton({ envio }: { envio: { id: number; guia: string | null } }) {
  const [open, setOpen] = useState(false)
  const [guiaInput, setGuiaInput] = useState(envio.guia ?? "")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleConfirmGuia = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!guiaInput.trim()) {
      setError("Ingresa el número de guía generado en el portal de Servientrega")
      return
    }
    startTransition(async () => {
      const result = await registrarGuiaAction({ envio_id: envio.id, guia: guiaInput })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setGuiaInput(envio.guia ?? "")
          setError("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Registrar Guía
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleConfirmGuia}>
          <DialogHeader>
            <DialogTitle>Registrar Guía de Servientrega</DialogTitle>
            <DialogDescription>
              Genera la guía manualmente en el portal de Servientrega y pega aquí el número real. Esto no llama a
              ninguna API externa: Servientrega requiere credenciales corporativas que aún no tenemos configuradas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor={`guia-real-${envio.id}`}>Número de Guía *</Label>
              <Input
                id={`guia-real-${envio.id}`}
                value={guiaInput}
                onChange={(e) => setGuiaInput(e.target.value)}
                placeholder="Número de guía de Servientrega"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              Registrar Guía
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
