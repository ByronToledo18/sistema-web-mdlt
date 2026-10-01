import "server-only"

import { and, eq, sql, type Column } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import type { UserPayload } from "@/lib/jwt"
import { hashPassword, needsRehash, verifyDummyPassword, verifyPassword } from "@/lib/password"
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
  | { ok: false; status: 401; error: string }

// Usuario inexistente, inactivo, sin contraseña o contraseña incorrecta
// responden igual (mismo status, mismo mensaje y, con verifyDummyPassword,
// tiempo parecido): el login no sirve para averiguar qué cuentas existen. El
// motivo real queda en la auditoría.
export const CREDENCIALES_INVALIDAS = "Credenciales inválidas"
export const LOGIN_FALLIDO = { ok: false, status: 401, error: CREDENCIALES_INVALIDAS } as const

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
      debe_cambiar_password: usuarios.debe_cambiar_password,
    })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .where(emailIgual(usuarios.email, email))
    .limit(1)

  // Siempre se calcula un PBKDF2, exista o no la cuenta.
  const passwordOk = usuario
    ? await verifyPassword(password, usuario.hash_password)
    : await verifyDummyPassword(password)

  if (!usuario) {
    await registrarAuditoria({
      ...auditoria,
      accion: "login_fallido",
      descripcion: `Intento de login fallido para email: ${email}`,
    })
    return LOGIN_FALLIDO
  }

  if (!usuario.activo) {
    await registrarAuditoria({
      ...auditoria,
      usuario_id: usuario.id,
      accion: "login_usuario_inactivo",
      descripcion: `Intento de login de usuario inactivo: ${usuario.email}`,
    })
    return LOGIN_FALLIDO
  }

  if (!passwordOk) {
    await registrarAuditoria({
      ...auditoria,
      usuario_id: usuario.id,
      accion: "login_password_incorrecto",
      descripcion: `Contraseña incorrecta para usuario: ${usuario.email}`,
    })
    return LOGIN_FALLIDO
  }

  // Hash antiguo (100 000 iteraciones, sin versión): se actualiza ahora que
  // se conoce la contraseña. No toca token_version.
  if (needsRehash(usuario.hash_password)) {
    await db
      .update(usuarios)
      .set({ hash_password: await hashPassword(password) })
      .where(eq(usuarios.id, usuario.id))
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
    sesion: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      rol_id: usuario.rol_id,
      debe_cambiar_password: usuario.debe_cambiar_password,
    },
    tokenVersion: usuario.token_version,
  }
}

// Logout: incrementa token_version, así el token deja de valer aunque
// alguien lo haya copiado antes de que se borrara la cookie. Solo si `tv` es
// la versión vigente (un token ya revocado no revoca nada). Cierra también
// las demás sesiones del usuario: hay una sola token_version por cuenta.
export async function revocarSesionUsuario(id: number, tv: unknown): Promise<boolean> {
  if (typeof tv !== "number") return false
  const filas = await db
    .update(usuarios)
    .set({ token_version: sql`${usuarios.token_version} + 1` })
    .where(and(eq(usuarios.id, id), eq(usuarios.token_version, tv)))
    .returning({ id: usuarios.id })
  return filas.length > 0
}

// Cambio de la propia contraseña del panel admin (/cambiar-password). Limpia
// debe_cambiar_password e incrementa token_version (cierra las demás
// sesiones); devuelve la versión nueva para re-emitir el token de la sesión
// actual.
export async function cambiarPasswordUsuario(
  id: number,
  passwordActual: string,
  nuevaPassword: string,
  meta: RequestMeta = {},
): Promise<number> {
  const [usuario] = await db
    .select({ id: usuarios.id, email: usuarios.email, hash_password: usuarios.hash_password })
    .from(usuarios)
    .where(eq(usuarios.id, id))
  if (!usuario || !(await verifyPassword(passwordActual, usuario.hash_password))) {
    throw new HttpError(400, "La contraseña actual es incorrecta")
  }
  if (passwordActual === nuevaPassword) {
    throw new HttpError(400, "La nueva contraseña debe ser distinta de la actual")
  }

  const [actualizado] = await db
    .update(usuarios)
    .set({
      hash_password: await hashPassword(nuevaPassword),
      debe_cambiar_password: false,
      token_version: sql`${usuarios.token_version} + 1`,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(usuarios.id, id))
    .returning({ token_version: usuarios.token_version })

  await registrarAuditoria({
    usuario_id: id,
    accion: "CAMBIO_PASSWORD",
    modulo: "auth",
    descripcion: `Cambió su contraseña: ${usuario.email}`,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  })
  return actualizado.token_version
}
