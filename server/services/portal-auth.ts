import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import type { ClientePayload } from "@/lib/jwt"
import { hashPassword, verifyPassword } from "@/lib/password"
import { generateWhatsAppLink } from "@/lib/whatsapp"
import { db } from "@/server/db/client"
import { clientes } from "@/server/db/schema"
import type { LoginInput, RegistroInput } from "@/server/validators/auth"
import { emailIgual, type ResultadoLogin } from "./auth"
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

  if (!cliente) {
    return { ok: false, status: 401, error: "Credenciales inválidas" }
  }
  if (!cliente.activo) {
    return { ok: false, status: 403, error: "Tu cuenta está desactivada. Contacta al soporte." }
  }
  if (!cliente.hash_password) {
    return { ok: false, status: 403, error: "Tu cuenta no tiene contraseña configurada. Contacta al administrador." }
  }
  if (!(await verifyPassword(password, cliente.hash_password))) {
    return { ok: false, status: 401, error: "Credenciales inválidas" }
  }

  await db.update(clientes).set({ ultimo_acceso: sql`CURRENT_TIMESTAMP` }).where(eq(clientes.id, cliente.id))

  return {
    ok: true,
    sesion: { id: cliente.id, email: cliente.email ?? email, nombre: cliente.nombre },
    tokenVersion: cliente.token_version,
  }
}

export async function registrarCliente(input: RegistroInput) {
  const [conEmail] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(emailIgual(clientes.email, input.email))
    .limit(1)
  if (conEmail) throw new HttpError(400, "Este email ya está registrado")

  const hash_password = await hashPassword(input.password)
  const datos = {
    nombre: input.nombre,
    email: input.email,
    telefono: input.telefono,
    direccion: input.direccion,
    hash_password,
  }

  // La cédula es el identificador canónico del cliente en todo el sistema
  // (es lo que usa el checkout del catálogo público, que no requiere login).
  // Si ya existe una fila de `clientes` con esa cédula - creada por un
  // pedido anónimo previo - la vinculamos en vez de crear un cliente
  // duplicado.
  const [conCedula] = await db
    .select({ id: clientes.id, hash_password: clientes.hash_password })
    .from(clientes)
    .where(eq(clientes.cedula, input.cedula))

  try {
    if (conCedula) {
      if (conCedula.hash_password) throw new HttpError(400, "Esta cédula ya tiene una cuenta registrada")
      const [cliente] = await db
        .update(clientes)
        .set({ ...datos, updated_at: sql`CURRENT_TIMESTAMP` })
        .where(eq(clientes.id, conCedula.id))
        .returning({ id: clientes.id, nombre: clientes.nombre, email: clientes.email })
      return cliente
    }

    const [cliente] = await db
      .insert(clientes)
      .values({ ...datos, cedula: input.cedula, activo: true })
      .returning({ id: clientes.id, nombre: clientes.nombre, email: clientes.email })
    return cliente
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw new HttpError(400, "La cédula o el email ya están registrados")
    }
    throw error
  }
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
