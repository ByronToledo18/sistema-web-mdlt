// Firma y verificación de los JWT de sesión, sin acceso a la BD ni a
// next/headers: lo importa el middleware (Edge) además de lib/auth.ts.
//
// Esta verificación solo comprueba firma, expiración y audiencia. La
// revocación (token_version, usuario activo) la hace lib/auth.ts contra la BD;
// el middleware solo la usa para redirigir rápido en cada navegación.

// Subrutas de jose: el índice arrastra JWE (CompressionStream), que el Edge
// Runtime del middleware no tiene.
import { SignJWT } from "jose/jwt/sign"
import { jwtVerify } from "jose/jwt/verify"

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

// Admin y portal firman con el mismo secreto pero con audiencias distintas,
// así un token del portal no sirve en el admin y viceversa.
const ADMIN_AUDIENCE = "admin"
const PORTAL_AUDIENCE = "portal"

// Sin JWT_SECRET no hay sesiones en ningún entorno: un valor por defecto
// conocido permitiría forjar tokens si llegara a desplegarse. Se lee al usarse
// (no al importar) para no romper módulos que solo necesitan hashPassword.
function secret(): Uint8Array {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET no está configurado. Defínelo en .env.local (desarrollo) o en las variables de entorno de Vercel.",
    )
  }
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

async function sign(payload: Record<string, unknown>, audience: string, expiresIn: string): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret())
}

async function verify(token: string, audience: string) {
  const key = secret() // fuera del try: un secreto faltante no es un "token inválido"
  try {
    const { payload } = await jwtVerify(token, key, { audience })
    return payload
  } catch {
    return null
  }
}

// Duración de las sesiones. Las cookies (server/auth/cookies.ts) usan los
// mismos valores como maxAge.
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24 // 24 horas
export const PORTAL_SESSION_SECONDS = 60 * 60 * 24 * 7 // 7 días

// `tv` = token_version del usuario/cliente al momento del login.
export async function generateToken(user: UserPayload, tokenVersion: number): Promise<string> {
  return await sign({ user, tv: tokenVersion }, ADMIN_AUDIENCE, `${ADMIN_SESSION_SECONDS}s`)
}

export async function generatePortalToken(cliente: ClientePayload, tokenVersion: number): Promise<string> {
  return await sign({ cliente, tv: tokenVersion }, PORTAL_AUDIENCE, `${PORTAL_SESSION_SECONDS}s`)
}

export async function verifyAdminToken(token: string): Promise<{ user: UserPayload; tv: unknown } | null> {
  const payload = await verify(token, ADMIN_AUDIENCE)
  return payload ? { user: payload.user as UserPayload, tv: payload.tv } : null
}

export async function verifyPortalToken(token: string): Promise<{ cliente: ClientePayload; tv: unknown } | null> {
  const payload = await verify(token, PORTAL_AUDIENCE)
  return payload ? { cliente: payload.cliente as ClientePayload, tv: payload.tv } : null
}

// Solo firma y audiencia. Para proteger datos usar getCurrentUser (lib/auth.ts).
export async function verifyToken(token: string): Promise<UserPayload | null> {
  return (await verifyAdminToken(token))?.user ?? null
}
