"use server"

import { revalidatePath } from "next/cache"
import { adminAction } from "@/server/auth/action"
import { actualizarCliente, alternarEstadoCliente, crearCliente } from "@/server/services/clientes"
import { actualizarClienteBody, crearClienteBody } from "@/server/validators/clientes"
import { id } from "@/server/validators/common"

const clienteId = id("Cliente")

// Devuelve la contraseña temporal del cliente nuevo para mostrarla una vez.
export async function crearClienteAction(input: unknown) {
  return adminAction({ permission: { module: "clientes", action: "create" }, error: "Error al crear cliente" }, async () => {
    const { tempPassword } = await crearCliente(crearClienteBody.parse(input))
    revalidatePath("/admin/clientes")
    return { tempPassword }
  })
}

export async function actualizarClienteAction(rawId: number, input: unknown) {
  return adminAction({ permission: { module: "clientes", action: "update" }, error: "Error al actualizar cliente" }, async () => {
    await actualizarCliente(clienteId.parse(rawId), actualizarClienteBody.parse(input))
    revalidatePath("/admin/clientes")
  })
}

export async function alternarEstadoClienteAction(rawId: number) {
  return adminAction(
    { permission: { module: "clientes", action: "delete" }, error: "Error al cambiar estado del cliente" },
    async () => {
      await alternarEstadoCliente(clienteId.parse(rawId))
      revalidatePath("/admin/clientes")
    },
  )
}
