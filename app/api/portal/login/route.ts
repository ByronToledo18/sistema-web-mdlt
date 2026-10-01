import { NextResponse } from "next/server"
import { generatePortalToken } from "@/lib/jwt"
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { setPortalSessionCookie } from "@/server/auth/cookies"
import { withErrors } from "@/server/auth/guard"
import { iniciarSesionCliente } from "@/server/services/portal-auth"
import { loginBody } from "@/server/validators/auth"
import { parseBody } from "@/server/validators/common"

export const POST = withErrors({ error: "Error al iniciar sesión" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.portalLogin)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }

  const resultado = await iniciarSesionCliente(await parseBody(request, loginBody))
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }

  const cliente = resultado.sesion
  await setPortalSessionCookie(await generatePortalToken(cliente, resultado.tokenVersion))

  return NextResponse.json({ cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email } })
})
