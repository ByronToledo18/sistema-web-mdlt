"use client"

import { SectionError } from "@/components/admin/section-error"

export default function ProveedoresError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} backHref="/admin/proveedores" backLabel="Volver a Proveedores" />
}
