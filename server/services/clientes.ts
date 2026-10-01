import "server-only"

import { randomInt } from "node:crypto"
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm"
import { hashPassword } from "@/lib/auth"
import { HttpError } from "@/lib/http"
import { db } from "@/server/db/client"
import { clientes } from "@/server/db/schema"
import type { DatosCliente } from "@/server/validators/clientes"
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "./_shared"

// Columnas que se devuelven al panel. Nunca hash_password ni reset_token: el
// SELECT * anterior los mandaba al navegador.
const columnasPublicas = {
  id: clientes.id,
  nombre: clientes.nombre,
  cedula: clientes.cedula,
  telefono: clientes.telefono,
  email: clientes.email,
  direccion: clientes.direccion,
  notas: clientes.notas,
  activo: clientes.activo,
  ultimo_acceso: clientes.ultimo_acceso,
  debe_cambiar_password: clientes.debe_cambiar_password,
  created_at: clientes.created_at,
  updated_at: clientes.updated_at,
}

export async function listarClientes(filtros: { search?: string; mostrarInactivos: boolean }) {
  const patron = `%${filtros.search ?? ""}%`
  return db
    .select(columnasPublicas)
    .from(clientes)
    .where(
      and(
        filtros.mostrarInactivos ? undefined : eq(clientes.activo, true),
        filtros.search
          ? or(
              ilike(clientes.nombre, patron),
              ilike(clientes.email, patron),
              ilike(clientes.telefono, patron),
              ilike(clientes.cedula, patron),
            )
          : undefined,
      ),
    )
    .orderBy(desc(clientes.created_at))
}

export async function obtenerCliente(id: number) {
  const [cliente] = await db.select(columnasPublicas).from(clientes).where(eq(clientes.id, id))
  if (!cliente) throw new HttpError(404, "Cliente no encontrado")
  return cliente
}

async function assertCedulaLibre(cedula: string | null, exceptoId?: number) {
  if (!cedula) return
  const [existente] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.cedula, cedula), exceptoId ? ne(clientes.id, exceptoId) : undefined))
  if (existente) throw new HttpError(400, "La cédula ya está registrada en el sistema")
}

function duplicado(error: unknown): never {
  if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
    throw new HttpError(400, "La cédula o el email ya están registrados en el sistema")
  }
  throw error
}

// Contraseña temporal legible (sin 0/O, 1/I/L). El cliente la cambia en su
// primer ingreso al portal (debe_cambiar_password).
function generarPasswordTemporal(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join("")
}

export async function crearCliente(datos: DatosCliente & { cedula: string }) {
  await assertCedulaLibre(datos.cedula)
  const tempPassword = generarPasswordTemporal()

  const [cliente] = await db
    .insert(clientes)
    .values({ ...datos, hash_password: await hashPassword(tempPassword), debe_cambiar_password: true })
    .returning(columnasPublicas)
    .catch(duplicado)

  return { cliente, tempPassword }
}

export async function actualizarCliente(id: number, datos: DatosCliente) {
  await assertCedulaLibre(datos.cedula, id)
  const [cliente] = await db
    .update(clientes)
    .set({ ...datos, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(clientes.id, id))
    .returning(columnasPublicas)
    .catch(duplicado)
  if (!cliente) throw new HttpError(404, "Cliente no encontrado")
  return cliente
}

export async function alternarEstadoCliente(id: number): Promise<boolean> {
  const [cliente] = await db
    .update(clientes)
    .set({
      activo: sql`NOT ${clientes.activo}`,
      // Cierra las sesiones del portal abiertas (también al reactivar).
      token_version: sql`${clientes.token_version} + 1`,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(clientes.id, id))
    .returning({ activo: clientes.activo })
  if (!cliente) throw new HttpError(404, "Cliente no encontrado")
  return cliente.activo ?? false
}

// --- Portal del cliente -----------------------------------------------------------

export async function obtenerPerfilCliente(id: number) {
  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      cedula: clientes.cedula,
      email: clientes.email,
      telefono: clientes.telefono,
      direccion: clientes.direccion,
      activo: clientes.activo,
    })
    .from(clientes)
    .where(eq(clientes.id, id))
  if (!cliente) throw new HttpError(404, "Cliente no encontrado")
  return cliente
}

export async function actualizarPerfilCliente(
  id: number,
  datos: { nombre: string; telefono: string | null; direccion: string | null },
) {
  const [cliente] = await db
    .update(clientes)
    .set({ ...datos, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(clientes.id, id))
    .returning({
      id: clientes.id,
      nombre: clientes.nombre,
      email: clientes.email,
      telefono: clientes.telefono,
      direccion: clientes.direccion,
    })
  if (!cliente) throw new HttpError(404, "Cliente no encontrado")
  return cliente
}
