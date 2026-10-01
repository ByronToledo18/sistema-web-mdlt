import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"
import { getClienteFromToken, getCurrentUser, type ClientePayload, type UserPayload } from "@/lib/auth"
import { can } from "@/server/auth/guard"
import type { Action, Module } from "@/lib/permissions"

// Usuario del panel admin para Server Components. `cache` hace que el layout y
// la página compartan una sola verificación del token por request.
export const getSessionUser = cache(getCurrentUser)

// Para layouts y páginas del admin: sin sesión, al login. Con una contraseña
// asignada por otra persona (debe_cambiar_password), solo /cambiar-password.
export async function requireUser(): Promise<UserPayload> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.debe_cambiar_password) redirect(CAMBIAR_PASSWORD_PATH)
  return user
}

export const CAMBIAR_PASSWORD_PATH = "/cambiar-password"

// Para páginas que exigen un permiso concreto. El middleware ya filtra por
// ROUTE_MODULES; esto cubre los permisos más finos (p. ej. crear vs. leer).
export async function requirePermission(module: Module, action: Action = "read"): Promise<UserPayload> {
  const user = await requireUser()
  if (!can(user, module, action)) redirect("/admin/dashboard")
  return user
}

// Cliente del portal para Server Components (cookie portal-auth-token). El
// proxy no protege /portal: cada página privada llama a requireCliente().
export const getSessionCliente = cache(getClienteFromToken)

export async function requireCliente(): Promise<ClientePayload> {
  const cliente = await getSessionCliente()
  if (!cliente) redirect("/portal/login")
  return cliente
}
