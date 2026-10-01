"use server"

import { revalidatePath } from "next/cache"
import { adminAction } from "@/server/auth/action"
import { registrarAuditoria } from "@/server/services/auditoria"
import {
  alternarEstadoUsuario,
  cambiarRolUsuario,
  crearUsuario,
  resetearPasswordUsuario,
} from "@/server/services/usuarios"
import { id } from "@/server/validators/common"
import { cambiarRolBody, crearUsuarioBody, resetPasswordBody } from "@/server/validators/usuarios"

const usuarioId = id("Usuario")

// Cada cambio de usuarios queda en la auditoría (crear, cambio de rol y
// reseteo la registran los servicios, con el rol asignado).
export async function crearUsuarioAction(input: unknown) {
  return adminAction({ permission: { module: "usuarios", action: "create" }, error: "Error al crear usuario" }, async (user) => {
    await crearUsuario(user, crearUsuarioBody.parse(input))
    revalidatePath("/admin/soporte")
  })
}

export async function cambiarRolUsuarioAction(rawId: number, input: unknown) {
  return adminAction({ permission: { module: "usuarios", action: "update" }, error: "Error al cambiar rol" }, async (user) => {
    const { rol_id } = cambiarRolBody.parse(input)
    await cambiarRolUsuario(user, usuarioId.parse(rawId), rol_id)
    revalidatePath("/admin/soporte")
  })
}

export async function resetearPasswordUsuarioAction(rawId: number, input: unknown) {
  return adminAction(
    { permission: { module: "usuarios", action: "update" }, error: "Error al resetear contraseña" },
    async (user) => {
      const { nueva_password } = resetPasswordBody.parse(input)
      await resetearPasswordUsuario(user, usuarioId.parse(rawId), nueva_password)
      revalidatePath("/admin/soporte")
    },
  )
}

export async function alternarEstadoUsuarioAction(rawId: number) {
  return adminAction(
    { permission: { module: "usuarios", action: "update" }, error: "Error al cambiar estado del usuario" },
    async (user) => {
      const id = usuarioId.parse(rawId)
      const activo = await alternarEstadoUsuario(user, id)
      await registrarAuditoria({
        usuario_id: user.id,
        accion: activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
        modulo: "usuarios",
        descripcion: `Usuario ID ${id} ${activo ? "activado" : "desactivado"}`,
      })
      revalidatePath("/admin/soporte")
    },
  )
}
