"use client"

import { SectionError } from "@/components/admin/section-error"

export default function ClientesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} />
}
