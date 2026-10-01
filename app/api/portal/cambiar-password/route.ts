import { NextResponse } from "next/server"
import { generatePortalToken } from "@/lib/jwt"
import { setPortalSessionCookie } from "@/server/auth/cookies"
import { withCliente } from "@/server/auth/guard"
import { cambiarPasswordCliente } from "@/server/services/portal-auth"
import { cambiarPasswordBody } from "@/server/validators/auth"
import { parseBody } from "@/server/validators/common"

export const POST = withCliente({ error: "Error al cambiar contraseña" }, async (request, _context, cliente) => {
  const { currentPassword, newPassword } = await parseBody(request, cambiarPasswordBody)
  const tokenVersion = await cambiarPasswordCliente(cliente.id, currentPassword, newPassword)

  // Las demás sesiones quedan invalidadas; la actual sigue con un token nuevo.
  await setPortalSessionCookie(await generatePortalToken(cliente, tokenVersion))
  return NextResponse.json({ success: true })
})
