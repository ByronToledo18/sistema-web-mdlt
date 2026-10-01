"use client"

import { SectionError } from "@/components/admin/section-error"

export default function PagosError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} />
}
