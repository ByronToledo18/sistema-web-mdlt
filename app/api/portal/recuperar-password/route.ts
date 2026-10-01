import { NextResponse } from "next/server"
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { withErrors } from "@/server/auth/guard"
import { solicitarReseteoCliente } from "@/server/services/portal-auth"
import { recuperarPasswordBody } from "@/server/validators/auth"
import { parseBody } from "@/server/validators/common"

export const POST = withErrors({ error: "Error al procesar solicitud" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.recuperarPassword)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }

  const { email } = await parseBody(request, recuperarPasswordBody)
  await solicitarReseteoCliente(email, process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin)

  // Misma respuesta exista o no el email.
  return NextResponse.json({ success: true })
})
