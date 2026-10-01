import "server-only"

import { ZodError } from "zod"
import type { UserPayload } from "@/lib/auth"
import { DEBE_CAMBIAR_PASSWORD, HttpError } from "@/lib/http"
import type { Action, Module } from "@/lib/permissions"
import { assertCan } from "@/server/auth/guard"
import { getSessionUser } from "@/server/auth/session"
import { logger } from "@/lib/logger"

// Resultado de una Server Action. Los errores esperados (validación, permisos,
// reglas de negocio) viajan como `error` para mostrarse en la UI; las
// excepciones de Next (redirect/notFound) se relanzan.
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

interface ActionOptions {
  // null = basta con estar autenticado.
  permission: { module: Module; action: Action } | null
  // Mensaje si algo falla de forma inesperada.
  error: string
  // Solo la acción de /cambiar-password: el resto responde 403 mientras el
  // usuario tenga debe_cambiar_password.
  permitirCambioPendiente?: boolean
}

// Equivalente de withAuth para Server Actions del panel admin:
//
//   export async function registrarPagoAction(input: unknown) {
//     return adminAction({ permission: { module: "pagos", action: "create" }, error: "…" }, async (user) => {
//       const pago = await registrarPago(user, registrarPagoBody.parse(input))
//       revalidatePath(`/admin/pedidos/${pago.pedido_id}`)
//       return pago
//     })
//   }
export async function adminAction<T>(
  options: ActionOptions,
  fn: (user: UserPayload) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await getSessionUser()
    if (!user) throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.")
    if (user.debe_cambiar_password && !options.permitirCambioPendiente) {
      throw new HttpError(403, DEBE_CAMBIAR_PASSWORD)
    }
    if (options.permission) {
      assertCan(user, options.permission.module, options.permission.action)
    }
    return { ok: true, data: await fn(user) }
  } catch (error) {
    if (isNextControlFlow(error)) throw error
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Datos inválidos" }
    }
    if (error instanceof HttpError && error.status < 500) {
      return { ok: false, error: error.message }
    }
    logger.error(`action: ${options.error}`, error)
    return { ok: false, error: options.error }
  }
}

// redirect() y notFound() lanzan errores con `digest` que Next debe recibir.
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"))
}
