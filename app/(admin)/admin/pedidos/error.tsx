"use client"

import { SectionError } from "@/components/admin/section-error"

export default function PedidosError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} backHref="/admin/pedidos" backLabel="Volver a Pedidos" />
}
