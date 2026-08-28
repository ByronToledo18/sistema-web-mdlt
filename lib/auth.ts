import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

// En producción, JWT_SECRET debe venir de una variable de entorno real - un
// fallback silencioso a un valor conocido permitiría forjar tokens válidos.
// En desarrollo se permite el fallback para no bloquear `npm run dev` sin .env.local.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET no está configurado. Defínelo como variable de entorno antes de desplegar.")
}

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-only-insecure-secret-do-not-deploy")

export interface UserPayload {
  id: number
  email: string
  nombre: string
  rol: string
  rol_id: number
}

export interface ClientePayload {
  id: number
  email: string
  nombre: string
}

// Obtener cliente del portal autenticado desde la cookie portal-auth-token
export async function getClienteFromToken(): Promise<ClientePayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("portal-auth-token")

  if (!token) {
    return null
  }

  try {
    const verified = await jwtVerify(token.value, JWT_SECRET)
    return verified.payload.cliente as ClientePayload
  } catch (error) {
    return null
  }
}

// Middleware helper para proteger rutas del portal de clientes
export async function requirePortalAuth(): Promise<ClientePayload> {
  const cliente = await getClienteFromToken()

  if (!cliente) {
    throw new Error("No autenticado")
  }

  return cliente
}

// Generar token JWT
export async function generateToken(user: UserPayload): Promise<string> {
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET)
}

// Verificar token JWT
export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET)
    return verified.payload.user as UserPayload
  } catch (error) {
    console.error("[v0] Token verification failed:", error)
    return null
  }
}

// Obtener usuario actual desde cookies
export async function getCurrentUser(): Promise<UserPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")

  if (!token) {
    return null
  }

  return await verifyToken(token.value)
}

export async function getUserFromRequest(request: Request): Promise<UserPayload | null> {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) {
    return null
  }

  // Parse cookies from header
  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    },
    {} as Record<string, string>,
  )

  const token = cookies["auth-token"]
  if (!token) {
    return null
  }

  return await verifyToken(token)
}

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
    console.log("[v0] Verifying password, hash format:", storedHash.substring(0, 10))

    // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
      console.log("[v0] Detected bcrypt hash - this format is no longer supported")
      console.log("[v0] Please run the password migration script or reset user passwords")
      return false
    }

    // Split stored hash into salt and hash
    const [saltHex, hashHex] = storedHash.split(":")

    if (!saltHex || !hashHex) {
      console.log("[v0] Invalid hash format - missing salt or hash")
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
    console.log("[v0] Password verification result:", isValid)
    return isValid
  } catch (error) {
    console.error("[v0] Password verification error:", error)
    return false
  }
}

// Verificar si el usuario tiene un rol específico
export function hasRole(user: UserPayload | null, roles: string[]): boolean {
  if (!user) return false
  return roles.includes(user.rol)
}

// Middleware helper para proteger rutas
export async function requireAuth(allowedRoles?: string[]): Promise<UserPayload> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("No autenticado")
  }

  if (allowedRoles && !hasRole(user, allowedRoles)) {
    throw new Error("No autorizado")
  }

  return user
}
