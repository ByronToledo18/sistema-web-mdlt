import "server-only"

import type { NextRequest } from "next/server"
import { ZodError } from "zod"
import { getClienteFromToken, getCurrentUser, type ClientePayload, type UserPayload } from "@/lib/auth"
import { apiError, HttpError } from "@/lib/http"
import { hasPermission, type Action, type Module } from "@/lib/permissions"
import { logger } from "@/lib/logger"

export type RouteContext<P> = { params: Promise<P> }

export function can(user: Pick<UserPayload, "rol">, module: Module, action: Action): boolean {
  return hasPermission(user.rol, module, action)
}

export function assertCan(user: Pick<UserPayload, "rol">, module: Module, action: Action): void {
  if (!can(user, module, action)) {
    throw new HttpError(403, "No autorizado")
  }
}

// Respuesta para cualquier error que salga de un route handler:
// ZodError → 400 con el primer mensaje de validación; HttpError → su status;
// el resto → 500 genérico (el detalle solo va al log).
export function routeError(error: unknown, fallbackMsg: string) {
  if (error instanceof ZodError) {
    return apiError(new HttpError(400, error.issues[0]?.message ?? "Datos inválidos"))
  }
  if (!(error instanceof HttpError) || error.status >= 500) {
    logger.error(`api: ${fallbackMsg}`, error)
  }
  return apiError(error, fallbackMsg)
}

interface AuthOptions {
  // null = basta con estar autenticado.
  permission: { module: Module; action: Action } | null
  // Mensaje del 500 si algo falla.
  error: string
}

// Route handler del panel admin: autentica, verifica el permiso y convierte
// cualquier error en la respuesta adecuada.
//
//   export const GET = withAuth({ permission: { module: "pedidos", action: "read" }, error: "…" },
//     async (request, { params }, user) => { … })
export function withAuth<P = Record<string, never>>(
  options: AuthOptions,
  handler: (request: NextRequest, context: RouteContext<P>, user: UserPayload) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<Response> => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        throw new HttpError(401, "No autenticado")
      }
      if (options.permission) {
        assertCan(user, options.permission.module, options.permission.action)
      }
      return await handler(request, context, user)
    } catch (error) {
      return routeError(error, options.error)
    }
  }
}

// Route handler del portal de clientes (cookie portal-auth-token).
export function withCliente<P = Record<string, never>>(
  options: { error: string; sinSesion?: string },
  handler: (request: NextRequest, context: RouteContext<P>, cliente: ClientePayload) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<Response> => {
    try {
      const cliente = await getClienteFromToken()
      if (!cliente) {
        throw new HttpError(401, options.sinSesion ?? "No autenticado")
      }
      return await handler(request, context, cliente)
    } catch (error) {
      return routeError(error, options.error)
    }
  }
}

// Route handler público: solo manejo de errores.
export function withErrors<P = Record<string, never>>(
  options: { error: string },
  handler: (request: NextRequest, context: RouteContext<P>) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<Response> => {
    try {
      return await handler(request, context)
    } catch (error) {
      return routeError(error, options.error)
    }
  }
}
