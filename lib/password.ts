// Hash y verificación de contraseñas (PBKDF2 con Web Crypto).
//
// Módulo puro, sin server-only ni dependencias de Next: lo usan lib/auth.ts,
// los servicios y los scripts (create-admin, seed-test) que corren con tsx.

import { logger } from "@/lib/logger"

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
    logger.error("lib/auth verifyPassword", error)
    return false
  }
}
