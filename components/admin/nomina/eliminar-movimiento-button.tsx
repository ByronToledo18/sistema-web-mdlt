"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { eliminarMovimientoAction } from "@/app/(admin)/admin/nomina/actions"

export function EliminarMovimientoButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm("¿Eliminar este movimiento de nómina?")) return
    startTransition(async () => {
      const result = await eliminarMovimientoAction(id)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}
