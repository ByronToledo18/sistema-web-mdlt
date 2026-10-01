"use client"

import { SectionError } from "@/components/admin/section-error"

export default function InventarioError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} />
}
