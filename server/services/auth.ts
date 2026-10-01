import "server-only"

import { eq, sql, type Column } from "drizzle-orm"
import type { UserPayload } from "@/lib/jwt"
import { verifyPassword } from "@/lib/password"
import { db } from "@/server/db/client"
import { roles, usuarios } from "@/server/db/schema"
import type { LoginInput } from "@/server/validators/auth"
import { registrarAuditoria } from "./auditoria"

// Autenticación del panel admin. Las rutas (app/api/auth/*) validan el body,
// firman el JWT y ponen la cookie; aquí vive el acceso a la BD.

export interface RequestMeta {
  ip?: string
  userAgent?: string
}

export type ResultadoLogin<T> =
  | { ok: true; sesion: T; tokenVersion: number }
  | { ok: false; status: 401 | 403; error: string }

// Los emails se guardan normalizados, pero puede haber filas antiguas con
// mayúsculas o espacios: la búsqueda compara la forma normalizada.
export const emailIgual = (columna: Column, email: string) => sql`lower(trim(${columna})) = ${email}`

export async function iniciarSesionAdmin(
  { email, password }: LoginInput,
  meta: RequestMeta = {},
): Promise<ResultadoLogin<UserPayload>> {
  const auditoria = { modulo: "auth", ip_address: meta.ip, user_agent: meta.userAgent }

  const [usuario] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      hash_password: usuarios.hash_password,
      activo: usuarios.activo,
      rol_id: usuarios.rol_id,
      rol: roles.nombre,
      token_version: usuarios.token_version,
    })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .where(emailIgual(usuarios.email, email))
    .limit(1)

  if (!usuario) {
    await registrarAuditoria({
      ...auditoria,
      accion: "login_fallido",
      descripcion: `Intento de login fallido para email: ${email}`,
    })
    return { ok: false, status: 401, error: "Credenciales inválidas" }
  }

  if (!usuario.activo) {
    await registrarAuditoria({
      ...auditoria,
      usuario_id: usuario.id,
      accion: "login_usuario_inactivo",
      descripcion: `Intento de login de usuario inactivo: ${usuario.email}`,
    })
    return { ok: false, status: 403, error: "Usuario inactivo" }
  }

  if (!(await verifyPassword(password, usuario.hash_password))) {
    await registrarAuditoria({
      ...auditoria,
      usuario_id: usuario.id,
      accion: "login_password_incorrecto",
      descripcion: `Contraseña incorrecta para usuario: ${usuario.email}`,
    })
    return { ok: false, status: 401, error: "Credenciales inválidas" }
  }

  await registrarAuditoria({
    ...auditoria,
    usuario_id: usuario.id,
    accion: "login_exitoso",
    descripcion: `Login exitoso: ${usuario.email}`,
    metadata: { rol: usuario.rol },
  })

  return {
    ok: true,
    sesion: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, rol_id: usuario.rol_id },
    tokenVersion: usuario.token_version,
  }
}
