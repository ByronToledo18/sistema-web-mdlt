import { NextResponse } from "next/server"
import { verifyPortalToken } from "@/lib/jwt"
import { clearPortalSessionCookie, PORTAL_COOKIE } from "@/server/auth/cookies"
import { withErrors } from "@/server/auth/guard"
import { revocarSesionCliente } from "@/server/services/portal-auth"

// POST - Cierra la sesión del portal: revoca el token (token_version + 1) y
// borra la cookie.
export const POST = withErrors({ error: "Error al cerrar sesión" }, async (request) => {
  const token = request.cookies.get(PORTAL_COOKIE)?.value
  const decoded = token ? await verifyPortalToken(token) : null
  if (decoded) {
    await revocarSesionCliente(decoded.cliente.id, decoded.tv)
  }

  await clearPortalSessionCookie()
  return NextResponse.json({ success: true })
})
