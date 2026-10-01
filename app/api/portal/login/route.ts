import { NextResponse } from "next/server"
import { generatePortalToken } from "@/lib/jwt"
import { rateLimit, conLimiteFallos, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
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

  const input = await parseBody(request, loginBody)
  // Además del límite por IP, uno de FALLOS por cuenta (email ya
  // normalizado): solo cuentan los logins fallidos y uno correcto lo resetea,
  // así nadie puede bloquear al dueño con POST al azar.
  const intento = await conLimiteFallos(RATE_LIMITS.portalLoginCuenta, input.email, () => iniciarSesionCliente(input), {
    fallo: (r) => !r.ok,
  })
  if (intento.bloqueado) {
    return rateLimitResponse(intento.retryAfter)
  }
  const resultado = intento.resultado
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }

  const cliente = resultado.sesion
  await setPortalSessionCookie(await generatePortalToken(cliente, resultado.tokenVersion))

  return NextResponse.json({
    cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email },
  })
})
