"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface BackButtonProps {
  href?: string
  label?: string
}

export function BackButton({ href, label = "Volver" }: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} className="gap-2 bg-transparent">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  )
}
