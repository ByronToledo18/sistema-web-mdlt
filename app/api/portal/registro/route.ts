import { NextResponse } from "next/server"
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { withErrors } from "@/server/auth/guard"
import { registrarCliente } from "@/server/services/portal-auth"
import { registroBody } from "@/server/validators/auth"
import { parseBody } from "@/server/validators/common"

export const POST = withErrors({ error: "Error al registrarse" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.portalRegistro)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }

  const cliente = await registrarCliente(await parseBody(request, registroBody))
  return NextResponse.json({ cliente }, { status: 201 })
})
