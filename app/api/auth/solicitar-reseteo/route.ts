import { NextResponse } from "next/server"
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { withErrors } from "@/server/auth/guard"
import { solicitarReseteoAdmin } from "@/server/services/usuarios"
import { parseBody } from "@/server/validators/common"
import { solicitarReseteoAdminBody } from "@/server/validators/usuarios"

// POST - "Olvidé mi contraseña" del login del panel admin. El ticket de
// reseteo lo arma el servidor; responde lo mismo exista o no el email.
export const POST = withErrors({ error: "Error al enviar la solicitud" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.reseteoAdmin)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }
  await solicitarReseteoAdmin(await parseBody(request, solicitarReseteoAdminBody))
  return NextResponse.json({ success: true })
})
