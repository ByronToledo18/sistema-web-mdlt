import "server-only"

import { and, asc, count, desc, eq, sql } from "drizzle-orm"
import { hashPassword } from "@/lib/auth"
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
  const [rol] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, rolId))
  if (!rol) throw new HttpError(400, "Rol inválido")
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

export async function eliminarUsuario(id: number) {
  return withTx(async (tx) => {
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    await assertNoEsElUltimo(tx, usuario, "eliminar")
    await tx.delete(usuarios).where(eq(usuarios.id, id))
    return usuario
  })
}

export async function cambiarRolUsuario(id: number, rolId: number) {
  await assertRolExiste(rolId)
  return withTx(async (tx) => {
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    if (usuario.rol_id !== rolId) {
      await assertNoEsElUltimo(tx, usuario, "cambiar el rol del")
    }
    await tx
      .update(usuarios)
      .set({ rol_id: rolId, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(usuarios.id, id))
    return usuario
  })
}

export async function alternarEstadoUsuario(id: number): Promise<boolean> {
  return withTx(async (tx) => {
    await bloquearCambiosDeUsuarios(tx)
    const usuario = await obtenerConRol(tx, id)
    await assertNoEsElUltimo(tx, usuario, "desactivar")
    const [actualizado] = await tx
      .update(usuarios)
      .set({ activo: sql`NOT ${usuarios.activo}`, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(usuarios.id, id))
      .returning({ activo: usuarios.activo })
    return actualizado.activo ?? false
  })
}

export async function resetearPasswordUsuario(id: number, nuevaPassword: string): Promise<void> {
  const actualizados = await db
    .update(usuarios)
    .set({ hash_password: await hashPassword(nuevaPassword), updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(usuarios.id, id))
    .returning({ id: usuarios.id })
  if (actualizados.length === 0) throw new HttpError(404, "Usuario no encontrado")
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
