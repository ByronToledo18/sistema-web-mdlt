"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { generarFacturaAction } from "@/app/(admin)/admin/pedidos/actions"

interface PedidoFacturaButtonProps {
  pedidoId: number
  factura: { numero_factura: string } | null
}

export function PedidoFacturaButton({ pedidoId, factura }: PedidoFacturaButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const facturaHref = `/admin/pedidos/${pedidoId}/factura`

  if (factura) {
    return (
      <Button variant="outline" onClick={() => router.push(facturaHref)}>
        Ver Factura ({factura.numero_factura})
      </Button>
    )
  }

  const handleGenerarFactura = () => {
    startTransition(async () => {
      const result = await generarFacturaAction(pedidoId)
      if (!result.ok) {
        alert(result.error)
        return
      }
      router.push(facturaHref)
    })
  }

  return (
    <Button variant="outline" onClick={handleGenerarFactura} disabled={isPending}>
      {isPending ? "Generando..." : "Generar Factura"}
    </Button>
  )
}
