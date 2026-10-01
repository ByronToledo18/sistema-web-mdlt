import { NextResponse } from "next/server"
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { withErrors } from "@/server/auth/guard"
import { resetearPasswordConToken } from "@/server/services/portal-auth"
import { resetPasswordBody } from "@/server/validators/auth"
import { parseBody } from "@/server/validators/common"

export const POST = withErrors({ error: "Error al restablecer la contraseña" }, async (request) => {
  const limit = await rateLimit(request, RATE_LIMITS.resetPassword)
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfter)
  }

  const { token, newPassword } = await parseBody(request, resetPasswordBody)
  await resetearPasswordConToken(token, newPassword)
  return NextResponse.json({ success: true })
})
