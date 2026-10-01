import { NextResponse, type NextRequest } from "next/server"
import { verifyAdminToken } from "@/lib/jwt"
import { getClientIp } from "@/lib/rate-limit"
import { ADMIN_COOKIE, clearAdminSessionCookie } from "@/server/auth/cookies"
import { withErrors } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { revocarSesionUsuario } from "@/server/services/auth"

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST to logout." }, { status: 405 })
}

// POST - Cierra la sesión: revoca el token (token_version + 1) y borra la cookie.
export const POST = withErrors({ error: "Error en el servidor" }, async (request: NextRequest) => {
  const token = request.cookies.get(ADMIN_COOKIE)?.value
  const decoded = token ? await verifyAdminToken(token) : null

  if (decoded && (await revocarSesionUsuario(decoded.user.id, decoded.tv))) {
    await registrarAuditoria({
      usuario_id: decoded.user.id,
      accion: "logout",
      modulo: "auth",
      descripcion: `Logout: ${decoded.user.email}`,
      ip_address: getClientIp(request),
      user_agent: request.headers.get("user-agent") ?? undefined,
    })
  }

  await clearAdminSessionCookie()
  return NextResponse.json({ success: true })
})
