import "server-only"

import { and, asc, count, desc, eq, sql } from "drizzle-orm"
import { hashPassword, type UserPayload } from "@/lib/auth"
import { HttpError } from "@/lib/http"
import { db, withTx, type Tx } from "@/server/db/client"
import { roles, tickets, usuarios } from "@/server/db/schema"
import type { CrearUsuario } from "@/server/validators/usuarios"
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "./_shared"

// Roles que siempre tienen que conservar al menos un usuario activo.
const ROLES_PROTEGIDOS: Record<string, string> = {
  administrador: "administrador activo",
  soporte: "usuario de soporte activo",
}

// Serializa los cambios de usuarios (desactivar, cambiar rol, eliminar): sin
// esto, dos administradores podían desactivarse el uno al otro a la vez y
// dejar el sistema sin ninguno.
const LOCK_USUARIOS = 72_001

async function bloquearCambiosDeUsuarios(tx: Tx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_USUARIOS})`)
}

async function obtenerConRol(tx: Tx, id: number) {
  const [usuario] = await tx
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      activo: usuarios.activo,
      rol_id: usuarios.rol_id,
      rol_nombre: roles.nombre,
    })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .where(eq(usuarios.id, id))
  if (!usuario) throw new HttpError(404, "Usuario no encontrado")
  return usuario
}

// Lanza 400 si `usuario` es el último activo de un rol protegido.
async function assertNoEsElUltimo(
  tx: Tx,
  usuario: { activo: boolean | null; rol_nombre: string },
  accion: string,
): Promise<void> {
  const descripcion = ROLES_PROTEGIDOS[usuario.rol_nombre]
  if (!descripcion || !usuario.activo) return

  const [{ value: activos }] = await tx
    .select({ value: count() })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .where(and(eq(roles.nombre, usuario.rol_nombre), eq(usuarios.activo, true)))
  if (activos <= 1) {
    throw new HttpError(400, `No se puede ${accion} el último ${descripcion} del sistema`)
  }
}

export async function listarUsuarios() {
  return db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol_id: usuarios.rol_id,
      activo: usuarios.activo,
      rol_nombre: roles.nombre,
      created_at: usuarios.created_at,
      updated_at: usuarios.updated_at,
    })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .orderBy(desc(usuarios.created_at))
}

export async function listarRoles() {
  return db.select({ id: roles.id, nombre: roles.nombre }).from(roles).orderBy(asc(roles.nombre))
}

async function assertRolExiste(rolId: number) {
  const [rol] = await db.select({ id: roles.id, nombre: roles.nombre }).from(roles).where(eq(roles.id, rolId))
  if (!rol) throw new HttpError(400, "Rol inválido")
  return rol
}

// --- Límites de soporte ----------------------------------------------------------------
//
// Soporte administra usuarios (y puede crear administradores nuevos), pero no
// puede escalar privilegios ni tomar el control de una cuenta de
// administrador: no cambia su propio rol, no cambia el rol de un administrador
// ni da el rol administrador a un usuario existente, y no resetea la
// contraseña ni desactiva/elimina a un administrador. El administrador no
// tiene estas restricciones. El rol del actor viene de la BD (getCurrentUser).

export type Actor = Pick<UserPayload, "id" | "rol">

const ADMINISTRADOR = "administrador"

function esAdministrador(actor: Actor) {
  return actor.rol === ADMINISTRADOR
}

function assertPuedeCambiarRol(actor: Actor, usuario: { id: number; rol_nombre: string }, rolNuevo: string) {
  if (esAdministrador(actor)) return
  if (usuario.id === actor.id) {
    throw new HttpError(403, "No puedes cambiar tu propio rol")
  }
  if (usuario.rol_nombre === ADMINISTRADOR) {
    throw new HttpError(403, "Solo un administrador puede cambiar el rol de otro administrador")
  }
  if (rolNuevo === ADMINISTRADOR) {
    throw new HttpError(403, "Solo un administrador puede asignar el rol administrador a un usuario existente")
  }
}

function assertPuedeGestionar(actor: Actor, usuario: { rol_nombre: string }, accion: string) {
  if (!esAdministrador(actor) && usuario.rol_nombre === ADMINISTRADOR) {
    throw new HttpError(403, `Solo un administrador puede ${accion} a otro administrador`)
  }
}

export async function crearUsuario(input: CrearUsuario) {
  await assertRolExiste(input.rol_id)
  const [existente] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, input.email))
  if (existente) throw new HttpError(400, "El email ya está registrado")

  try {
    const [usuario] = await db
      .insert(usuarios)
      .values({
        nombre: input.nombre,
        email: input.email,
        hash_password: await hashPassword(input.password),
        rol_id: input.rol_id,
        activo: true,
      })
      .returning({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email })
    return usuario
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) throw new HttpError(400, "El email ya está registrado")
    throw error
  }
}

export async function eliminarUsuario(actor: Actor, id: number) {
  return withTx(async (tx) => {
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    assertPuedeGestionar(actor, usuario, "eliminar")
    await assertNoEsElUltimo(tx, usuario, "eliminar")
    await tx.delete(usuarios).where(eq(usuarios.id, id))
    return usuario
  })
}

export async function cambiarRolUsuario(actor: Actor, id: number, rolId: number) {
  const rolNuevo = await assertRolExiste(rolId)
  return withTx(async (tx) => {
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    assertPuedeCambiarRol(actor, usuario, rolNuevo.nombre)
    if (usuario.rol_id !== rolId) {
      await assertNoEsElUltimo(tx, usuario, "cambiar el rol del")
    }
    await tx
      .update(usuarios)
      .set({
        rol_id: rolId,
        // Un rol nuevo invalida las sesiones abiertas (el rol también se relee de la BD).
        token_version: usuario.rol_id !== rolId ? sql`${usuarios.token_version} + 1` : undefined,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(usuarios.id, id))
    return usuario
  })
}

export async function alternarEstadoUsuario(actor: Actor, id: number): Promise<boolean> {
  return withTx(async (tx) => {
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    assertPuedeGestionar(actor, usuario, "desactivar o reactivar")
    await assertNoEsElUltimo(tx, usuario, "desactivar")
    const [actualizado] = await tx
      .update(usuarios)
      .set({
        activo: sql`NOT ${usuarios.activo}`,
        // También al reactivar: una sesión de antes de desactivarlo no revive.
        token_version: sql`${usuarios.token_version} + 1`,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(usuarios.id, id))
      .returning({ activo: usuarios.activo })
    return actualizado.activo ?? false
  })
}

export async function resetearPasswordUsuario(actor: Actor, id: number, nuevaPassword: string): Promise<void> {
  const hash = await hashPassword(nuevaPassword)
  await withTx(async (tx) => {
    // Con el lock, nadie puede volver administrador al usuario entre la
    // verificación y el UPDATE.
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    assertPuedeGestionar(actor, usuario, "resetear la contraseña de")
    await tx
      .update(usuarios)
      .set({
        hash_password: hash,
        token_version: sql`${usuarios.token_version} + 1`,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(usuarios.id, id))
  })
}

// --- Tickets de soporte ----------------------------------------------------------------

export async function listarTickets(estado?: string) {
  return db
    .select({
      id: tickets.id,
      tipo: tickets.tipo,
      prioridad: tickets.prioridad,
      descripcion: tickets.descripcion,
      estado: tickets.estado,
      email_contacto: tickets.email_contacto,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
    })
    .from(tickets)
    .where(estado ? eq(tickets.estado, estado) : undefined)
    .orderBy(desc(tickets.created_at))
}

export async function crearTicket(input: {
  tipo: string
  prioridad: string
  descripcion: string
  email_contacto: string | null
}) {
  const [ticket] = await db
    .insert(tickets)
    .values({ ...input, estado: "pendiente" })
    .returning()
  return ticket
}
