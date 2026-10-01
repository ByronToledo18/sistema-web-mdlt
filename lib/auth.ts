import "server-only"

import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { HttpError } from "@/lib/http"
import { verifyAdminToken, verifyPortalToken, type ClientePayload, type UserPayload } from "@/lib/jwt"
import { db } from "@/server/db/client"
import { clientes, roles, usuarios } from "@/server/db/schema"

export type { ClientePayload, UserPayload } from "@/lib/jwt"
export { generatePortalToken, generateToken } from "@/lib/jwt"

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
    })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rol_id, roles.id))
    .where(eq(usuarios.id, decoded.user.id))

  if (!row || !row.activo || row.token_version !== decoded.tv) {
    return null
  }

  return { ...decoded.user, rol: row.rol, rol_id: row.rol_id }
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

// ---------------------------------------------------------------------------
// Contraseñas
// ---------------------------------------------------------------------------

// Hash de contraseña usando Web Crypto API (PBKDF2)
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Convert password to buffer
  const passwordBuffer = new TextEncoder().encode(password)

  // Import the password as a key
  const key = await crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveBits"])

  // Derive bits using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  )

  // Convert to hex strings
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Return salt:hash format
  return `${saltHex}:${hashHex}`
}

// Verificar contraseña usando Web Crypto API
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
      return false
    }

    // Split stored hash into salt and hash
    const [saltHex, hashHex] = storedHash.split(":")

    if (!saltHex || !hashHex) {
      return false
    }

    // Convert hex strings back to Uint8Array
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))

    // Convert password to buffer
    const passwordBuffer = new TextEncoder().encode(password)

    // Import the password as a key
    const key = await crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveBits"])

    // Derive bits using PBKDF2 with the same salt
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    )

    // Convert to hex string
    const computedHashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // Compare hashes
    const isValid = computedHashHex === hashHex
    return isValid
  } catch (error) {
    console.error("[v0] Password verification error:", error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Legacy: solo lo usa app/api/upload hasta migrarlo a withAuth.
// ---------------------------------------------------------------------------

export async function requireAuth(allowedRoles?: string[]): Promise<UserPayload> {
  const user = await getCurrentUser()

  if (!user) {
    throw new HttpError(401, "No autenticado")
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    throw new HttpError(403, "No autorizado")
  }

  return user
}
