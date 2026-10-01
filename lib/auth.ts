import "server-only"

import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { verifyAdminToken, verifyPortalToken, type ClientePayload, type UserPayload } from "@/lib/jwt"
import { db } from "@/server/db/client"
import { clientes, roles, usuarios } from "@/server/db/schema"

export type { ClientePayload, UserPayload } from "@/lib/jwt"
export { generatePortalToken, generateToken } from "@/lib/jwt"
export { hashPassword, verifyPassword } from "@/lib/password"

// ---------------------------------------------------------------------------
// Sesión
//
// Además de la firma (lib/jwt.ts), cada lectura de sesión confirma contra la
// BD que la cuenta sigue activa y que su token_version es el del token. Así,
// desactivar una cuenta, cambiarle el rol o resetear su contraseña invalida
// las sesiones abiertas. withAuth, withCliente, adminAction y getSessionUser
// pasan todos por estas dos funciones.
// ---------------------------------------------------------------------------

// Usuario del panel admin (cookie auth-token). El rol se toma de la BD, no del token.
export async function getCurrentUser(): Promise<UserPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")
  if (!token) {
    return null
  }

  const decoded = await verifyAdminToken(token.value)
  if (!decoded) {
    return null
  }

  const [row] = await db
    .select({
      activo: usuarios.activo,
      token_version: usuarios.token_version,
      rol_id: usuarios.rol_id,
      rol: roles.nombre,
      debe_cambiar_password: usuarios.debe_cambiar_password,
    })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .where(eq(usuarios.id, decoded.user.id))

  if (!row || !row.activo || row.token_version !== decoded.tv) {
    return null
  }

  return { ...decoded.user, rol: row.rol, rol_id: row.rol_id, debe_cambiar_password: row.debe_cambiar_password }
}

// Cliente del portal (cookie portal-auth-token).
export async function getClienteFromToken(): Promise<ClientePayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("portal-auth-token")
  if (!token) {
    return null
  }

  const decoded = await verifyPortalToken(token.value)
  if (!decoded) {
    return null
  }

  const [row] = await db
    .select({ activo: clientes.activo, token_version: clientes.token_version })
    .from(clientes)
    .where(eq(clientes.id, decoded.cliente.id))

  if (!row || !row.activo || row.token_version !== decoded.tv) {
    return null
  }

  return decoded.cliente
}
