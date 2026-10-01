"use client"

import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cambiarEstadoPedidoAction } from "@/app/(admin)/admin/pedidos/actions"

interface PedidoEstadoSelectProps {
  pedidoId: number
  estado: string
  saldoPendiente: number
  disabled: boolean
}

export function PedidoEstadoSelect({ pedidoId, estado, saldoPendiente, disabled }: PedidoEstadoSelectProps) {
  const [isPending, startTransition] = useTransition()

  const handleEstadoChange = (nuevoEstado: string) => {
    if (nuevoEstado === "terminado" && saldoPendiente > 0) {
      alert("No se puede marcar el pedido como terminado mientras existan valores pendientes por cancelar.")
      return
    }
    startTransition(async () => {
      const result = await cambiarEstadoPedidoAction(pedidoId, { estado: nuevoEstado })
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <Select value={estado} onValueChange={handleEstadoChange} disabled={isPending || disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="recibido">Recibido</SelectItem>
        <SelectItem value="en_proceso">En Proceso</SelectItem>
        <SelectItem value="terminado">Terminado</SelectItem>
        <SelectItem value="anulado">Anulado</SelectItem>
        <SelectItem value="entregado">Entregado</SelectItem>
      </SelectContent>
    </Select>
  )
}
