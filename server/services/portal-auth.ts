import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { and, eq, isNull, ne, sql } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import type { ClientePayload } from "@/lib/jwt"
import { hashPassword, needsRehash, verifyDummyPassword, verifyPassword } from "@/lib/password"
import { generateWhatsAppLink } from "@/lib/whatsapp"
import { db } from "@/server/db/client"
import { clientes } from "@/server/db/schema"
import { normalizarEmail, normalizarTelefono, type LoginInput, type RegistroInput } from "@/server/validators/auth"
import { emailIgual, LOGIN_FALLIDO, type ResultadoLogin } from "./auth"
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "./_shared"
import { crearTicket } from "./usuarios"

// Autenticación del portal de clientes (app/api/portal/*). Las rutas validan
// el body con server/validators/auth.ts, firman el JWT y manejan la cookie.

const RESET_TOKEN_MS = 60 * 60 * 1000 // 1 hora

// El token de reseteo viaja en el enlace; en la BD solo se guarda su SHA-256,
// así una copia de la tabla no permite resetear contraseñas.
function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function iniciarSesionCliente({
  email,
  password,
}: LoginInput): Promise<ResultadoLogin<ClientePayload>> {
  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      email: clientes.email,
      hash_password: clientes.hash_password,
      activo: clientes.activo,
      token_version: clientes.token_version,
    })
    .from(clientes)
    .where(emailIgual(clientes.email, email))
    .limit(1)

  // Inexistente, inactivo, sin contraseña o contraseña incorrecta: misma
  // respuesta y siempre un PBKDF2 (ver LOGIN_FALLIDO en ./auth).
  const hash = cliente?.hash_password
  const passwordOk = hash ? await verifyPassword(password, hash) : await verifyDummyPassword(password)
  if (!cliente || !cliente.activo || !hash || !passwordOk) {
    return LOGIN_FALLIDO
  }

  await db
    .update(clientes)
    .set({
      ultimo_acceso: sql`CURRENT_TIMESTAMP`,
      // Hash antiguo (100 000 iteraciones): se actualiza ahora que se conoce la contraseña.
      ...(needsRehash(hash) ? { hash_password: await hashPassword(password) } : {}),
    })
    .where(eq(clientes.id, cliente.id))

  return {
    ok: true,
    sesion: { id: cliente.id, email: cliente.email ?? email, nombre: cliente.nombre },
    tokenVersion: cliente.token_version,
  }
}

// Mensaje único para cualquier registro que choque con un cliente existente
// (cédula con cuenta, email ya usado, datos que no se pueden vincular): no
// revela qué dato existe ni de quién es.
export const REGISTRO_NO_VINCULABLE = "No se pudo completar el registro, contacta a la tienda"

// Lo que devuelve el registro (y la ruta, con 201): nada que no haya enviado
// quien se registra. En particular, nunca el email de un cliente existente.
export interface ClienteRegistrado {
  id: number
  nombre: string
}

export async function registrarCliente(input: RegistroInput): Promise<ClienteRegistrado> {
  // La cédula es el identificador canónico del cliente en todo el sistema.
  // Si ya existe una fila de `clientes` con esa cédula (creada por el admin o
  // por un pedido) y sin contraseña, se vincula en vez de crear un duplicado,
  // pero SOLO si el email coincide: conocer la cédula no basta para
  // apropiarse del cliente y ver su historial.
  const [conCedula] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      email: clientes.email,
      telefono: clientes.telefono,
      direccion: clientes.direccion,
      hash_password: clientes.hash_password,
    })
    .from(clientes)
    .where(eq(clientes.cedula, input.cedula))

  if (conCedula?.hash_password) throw new HttpError(400, REGISTRO_NO_VINCULABLE)

  const [conEmail] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(emailIgual(clientes.email, input.email), conCedula ? ne(clientes.id, conCedula.id) : undefined))
    .limit(1)
  if (conEmail) throw new HttpError(400, REGISTRO_NO_VINCULABLE)

  if (conCedula && !coincideEmail(conCedula.email, input.email)) {
    // Solo coincide el teléfono: puede ser el dueño con otro email, pero el
    // teléfono no prueba identidad. No se vincula; la tienda lo verifica.
    if (coincideTelefono(conCedula.telefono, input.telefono)) {
      await crearTicket({
        tipo: "consulta",
        prioridad: "media",
        descripcion:
          `Registro en el portal no vinculado: la cédula ${input.cedula} ya es el cliente #${conCedula.id} ` +
          `(${conCedula.nombre}) y el teléfono coincide, pero el email no. Verifica la identidad antes de ` +
          `vincular la cuenta.\n\nDatos enviados: nombre ${input.nombre}, email ${input.email}, ` +
          `teléfono ${input.telefono ?? "-"}, dirección ${input.direccion ?? "-"}.`,
        email_contacto: input.email,
      })
    }
    throw new HttpError(400, REGISTRO_NO_VINCULABLE)
  }

  const hash_password = await hashPassword(input.password)

  try {
    if (conCedula) {
      // Los datos de contacto existentes no se reemplazan; solo se completan
      // los que faltan.
      const [cliente] = await db
        .update(clientes)
        .set({
          hash_password,
          telefono: conCedula.telefono ?? input.telefono,
          direccion: conCedula.direccion ?? input.direccion,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        // Sin contraseña todavía: dos registros a la vez no vinculan dos veces.
        .where(and(eq(clientes.id, conCedula.id), isNull(clientes.hash_password)))
        .returning({ id: clientes.id, nombre: clientes.nombre })
      if (!cliente) throw new HttpError(400, REGISTRO_NO_VINCULABLE)
      return cliente
    }

    const [cliente] = await db
      .insert(clientes)
      .values({
        nombre: input.nombre,
        cedula: input.cedula,
        email: input.email,
        telefono: input.telefono,
        direccion: input.direccion,
        hash_password,
        activo: true,
      })
      .returning({ id: clientes.id, nombre: clientes.nombre })
    return cliente
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw new HttpError(400, REGISTRO_NO_VINCULABLE)
    }
    throw error
  }
}

function coincideEmail(existente: string | null, email: string): boolean {
  return !!existente && normalizarEmail(existente) === email
}

function coincideTelefono(existente: string | null, telefono: string | null): boolean {
  return !!existente && !!telefono && normalizarTelefono(existente) === normalizarTelefono(telefono)
}

// Genera un enlace de reseteo de un solo uso y lo deja en un ticket de
// soporte: no hay servicio de email, el canal con los clientes es WhatsApp
// (lib/whatsapp.ts) y el equipo reenvía el enlace. El enlace nunca se loguea
// ni se devuelve en la respuesta: solo vive en el ticket, visible para
// soporte/administrador. Si el email no existe no hace nada (la ruta responde
// lo mismo en ambos casos).
export async function solicitarReseteoCliente(email: string, appUrl: string): Promise<void> {
  const [cliente] = await db
    .select({ id: clientes.id, nombre: clientes.nombre, email: clientes.email, telefono: clientes.telefono })
    .from(clientes)
    .where(emailIgual(clientes.email, email))
    .limit(1)
  if (!cliente) return

  const token = randomBytes(32).toString("hex")
  await db
    .update(clientes)
    .set({ reset_token: hashResetToken(token), reset_token_expiry: new Date(Date.now() + RESET_TOKEN_MS) })
    .where(eq(clientes.id, cliente.id))

  const resetUrl = `${appUrl}/portal/reset-password?token=${token}`
  const mensaje = `Hola ${cliente.nombre}, aquí está tu enlace para restablecer tu contraseña (válido por 1 hora): ${resetUrl}`
  const whatsappLink = cliente.telefono ? generateWhatsAppLink(cliente.telefono, mensaje) : null

  await crearTicket({
    tipo: "reseteo_contraseña",
    prioridad: "alta",
    descripcion: `Solicitud de reseteo de contraseña para: ${cliente.nombre} (${cliente.email}).\n\n${
      whatsappLink
        ? `Reenviar por WhatsApp: ${whatsappLink}`
        : `El cliente no tiene teléfono registrado. Enlace de reseteo: ${resetUrl}`
    }`,
    email_contacto: cliente.email,
  })
}

export async function resetearPasswordConToken(token: string, nuevaPassword: string): Promise<void> {
  const [cliente] = await db
    .select({ id: clientes.id, reset_token_expiry: clientes.reset_token_expiry })
    .from(clientes)
    .where(eq(clientes.reset_token, hashResetToken(token)))
  if (!cliente) throw new HttpError(400, "Enlace inválido o ya utilizado")

  if (!cliente.reset_token_expiry || new Date(cliente.reset_token_expiry) < new Date()) {
    throw new HttpError(400, "El enlace ha expirado. Solicita uno nuevo.")
  }

  // Un solo uso: se limpian el token y su expiración al consumirse. También
  // se invalidan las sesiones abiertas, por si alguien más tenía acceso.
  await db
    .update(clientes)
    .set({
      hash_password: await hashPassword(nuevaPassword),
      reset_token: null,
      reset_token_expiry: null,
      debe_cambiar_password: false,
      token_version: sql`${clientes.token_version} + 1`,
    })
    .where(eq(clientes.id, cliente.id))
}

// Devuelve la token_version nueva: las demás sesiones quedan invalidadas y la
// ruta re-emite el token de la sesión actual.
export async function cambiarPasswordCliente(
  clienteId: number,
  passwordActual: string,
  nuevaPassword: string,
): Promise<number> {
  const [cliente] = await db
    .select({ id: clientes.id, hash_password: clientes.hash_password })
    .from(clientes)
    .where(eq(clientes.id, clienteId))
  if (!cliente) throw new HttpError(404, "Cliente no encontrado")

  if (!cliente.hash_password || !(await verifyPassword(passwordActual, cliente.hash_password))) {
    throw new HttpError(401, "La contraseña actual es incorrecta")
  }

  const [actualizado] = await db
    .update(clientes)
    .set({ hash_password: await hashPassword(nuevaPassword), token_version: sql`${clientes.token_version} + 1` })
    .where(eq(clientes.id, cliente.id))
    .returning({ token_version: clientes.token_version })
  return actualizado.token_version
}

// Logout del portal: igual que revocarSesionUsuario (server/services/auth.ts).
export async function revocarSesionCliente(id: number, tv: unknown): Promise<boolean> {
  if (typeof tv !== "number") return false
  const filas = await db
    .update(clientes)
    .set({ token_version: sql`${clientes.token_version} + 1` })
    .where(and(eq(clientes.id, id), eq(clientes.token_version, tv)))
    .returning({ id: clientes.id })
  return filas.length > 0
}
