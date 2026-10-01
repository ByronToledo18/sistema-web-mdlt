// Hash y verificación de contraseñas (PBKDF2-SHA256 con Web Crypto).
//
// Módulo puro, sin server-only ni dependencias de Next: lo usan lib/auth.ts,
// los servicios y los scripts (create-admin, seed-test) que corren con tsx.
//
// Formatos guardados en hash_password:
// - Actual:  "pbkdf2-sha256$<iteraciones>$<salt hex>$<hash hex>"
// - Antiguo: "<salt hex>:<hash hex>" con 100 000 iteraciones. Sigue
//   verificando; needsRehash() avisa para re-hashearlo en el próximo login.

import { logger } from "@/lib/logger"

const PREFIJO = "pbkdf2-sha256"
export const PBKDF2_ITERATIONS = 600_000
const LEGACY_ITERATIONS = 100_000
// Tope para un hash guardado con un número absurdo de iteraciones (DoS).
const MAX_ITERATIONS = 5_000_000
const SALT_BYTES = 16
const HASH_BITS = 256

interface HashParseado {
  iteraciones: number
  salt: Uint8Array
  hash: Uint8Array
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

function parseHash(stored: string): HashParseado | null {
  if (stored.startsWith(`${PREFIJO}$`)) {
    const [, iter, saltHex, hashHex, ...resto] = stored.split("$")
    const iteraciones = Number(iter)
    if (resto.length > 0 || !Number.isInteger(iteraciones) || iteraciones < 1 || iteraciones > MAX_ITERATIONS) {
      return null
    }
    const salt = fromHex(saltHex ?? "")
    const hash = fromHex(hashHex ?? "")
    return salt && hash ? { iteraciones, salt, hash } : null
  }

  // Formato antiguo "salt:hash" (100 000 iteraciones).
  const partes = stored.split(":")
  if (partes.length !== 2) return null
  const salt = fromHex(partes[0])
  const hash = fromHex(partes[1])
  return salt && hash ? { iteraciones: LEGACY_ITERATIONS, salt, hash } : null
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

// Comparación en tiempo constante: recorre siempre todos los bytes, así el
// tiempo no revela cuántos coinciden.
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, PBKDF2_ITERATIONS)
  return `${PREFIJO}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  try {
    const parsed = storedHash ? parseHash(storedHash) : null
    if (!parsed) return false
    const computed = await derive(password, parsed.salt, parsed.iteraciones)
    return timingSafeEqualBytes(computed, parsed.hash)
  } catch (error) {
    logger.error("lib/password verifyPassword", error)
    return false
  }
}

// true si el hash no está en el formato actual o usa menos iteraciones: tras
// un login correcto conviene guardar hashPassword(password) en su lugar.
export function needsRehash(storedHash: string): boolean {
  const parsed = parseHash(storedHash)
  return !parsed || !storedHash.startsWith(`${PREFIJO}$`) || parsed.iteraciones < PBKDF2_ITERATIONS
}
