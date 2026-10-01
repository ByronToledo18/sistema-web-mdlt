"use server"

import { headers } from "next/headers"
import { generateToken } from "@/lib/jwt"
import { adminAction } from "@/server/auth/action"
import { setAdminSessionCookie } from "@/server/auth/cookies"
import { cambiarPasswordUsuario } from "@/server/services/auth"
import { cambiarPasswordBody } from "@/server/validators/auth"

// Única acción permitida mientras el usuario tenga debe_cambiar_password.
// Limpia la marca, incrementa token_version (cierra las demás sesiones) y
// re-emite el token de esta sesión, ya sin la marca.
export async function cambiarPasswordPropiaAction(input: unknown) {
  return adminAction(
    { permission: null, error: "Error al cambiar la contraseña", permitirCambioPendiente: true },
    async (user) => {
      const { currentPassword, newPassword } = cambiarPasswordBody.parse(input)
      const h = await headers()
      const tokenVersion = await cambiarPasswordUsuario(user.id, currentPassword, newPassword, {
        ip: h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || undefined,
        userAgent: h.get("user-agent") ?? undefined,
      })
      const sesion = { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, rol_id: user.rol_id }
      await setAdminSessionCookie(await generateToken(sesion, tokenVersion))
    },
  )
}
