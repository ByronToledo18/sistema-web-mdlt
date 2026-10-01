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

// Cada cambio de usuarios queda en la auditoría, igual que en /api/soporte.
export async function crearUsuarioAction(input: unknown) {
  return adminAction({ permission: { module: "usuarios", action: "create" }, error: "Error al crear usuario" }, async (user) => {
    const usuario = await crearUsuario(crearUsuarioBody.parse(input))
    await registrarAuditoria({
      usuario_id: user.id,
      accion: "CREAR",
      modulo: "usuarios",
      descripcion: `Creó el usuario ${usuario.nombre} (${usuario.email})`,
    })
    revalidatePath("/admin/soporte")
  })
}

export async function cambiarRolUsuarioAction(rawId: number, input: unknown) {
  return adminAction({ permission: { module: "usuarios", action: "update" }, error: "Error al cambiar rol" }, async (user) => {
    const { rol_id } = cambiarRolBody.parse(input)
    const usuario = await cambiarRolUsuario(usuarioId.parse(rawId), rol_id)
    await registrarAuditoria({
      usuario_id: user.id,
      accion: "CAMBIO_ROL",
      modulo: "usuarios",
      descripcion: `Cambió el rol del usuario ${usuario.nombre} (${usuario.email})`,
    })
    revalidatePath("/admin/soporte")
  })
}

export async function resetearPasswordUsuarioAction(rawId: number, input: unknown) {
  return adminAction(
    { permission: { module: "usuarios", action: "update" }, error: "Error al resetear contraseña" },
    async (user) => {
      const id = usuarioId.parse(rawId)
      const { nueva_password } = resetPasswordBody.parse(input)
      await resetearPasswordUsuario(id, nueva_password)
      await registrarAuditoria({
        usuario_id: user.id,
        accion: "RESET_PASSWORD",
        modulo: "usuarios",
        descripcion: `Contraseña reseteada para usuario ID ${id}`,
      })
      revalidatePath("/admin/soporte")
    },
  )
}

export async function alternarEstadoUsuarioAction(rawId: number) {
  return adminAction(
    { permission: { module: "usuarios", action: "update" }, error: "Error al cambiar estado del usuario" },
    async (user) => {
      const id = usuarioId.parse(rawId)
      const activo = await alternarEstadoUsuario(id)
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
