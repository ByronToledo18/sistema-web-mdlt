import { NextResponse } from "next/server"
import { generateToken } from "@/lib/jwt"
import { getClientIp, rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { setAdminSessionCookie } from "@/server/auth/cookies"
import { withErrors } from "@/server/auth/guard"
import { iniciarSesionAdmin } from "@/server/services/auth"
import { loginBody } from "@/server/validators/auth"
import { parseBody } from "@/server/validators/common"

export const POST = withErrors({ error: "Error en el servidor" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.adminLogin)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }

  const input = await parseBody(request, loginBody)
  const resultado = await iniciarSesionAdmin(input, {
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  })
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }

  const user = resultado.sesion
  await setAdminSessionCookie(await generateToken(user, resultado.tokenVersion))

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
  })
})
