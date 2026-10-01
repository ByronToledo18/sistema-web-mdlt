"use server"

import { revalidatePath } from "next/cache"
import { adminAction } from "@/server/auth/action"
import { eliminarMovimiento, registrarMovimiento } from "@/server/services/nomina"
import { id } from "@/server/validators/common"
import { registrarMovimientoBody } from "@/server/validators/nomina"

export async function registrarMovimientoAction(input: unknown) {
  return adminAction({ permission: { module: "nomina", action: "create" }, error: "Error al registrar movimiento" }, async () => {
    await registrarMovimiento(registrarMovimientoBody.parse(input))
    revalidatePath("/admin/nomina")
  })
}

export async function eliminarMovimientoAction(rawId: number) {
  return adminAction({ permission: { module: "nomina", action: "delete" }, error: "Error al eliminar movimiento" }, async () => {
    await eliminarMovimiento(id("Movimiento").parse(rawId))
    revalidatePath("/admin/nomina")
  })
}
