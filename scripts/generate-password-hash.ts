// Script para generar hash de contraseña compatible con Web Crypto API (mismo
// formato que lib/auth.ts hashPassword/verifyPassword).
// Ejecutar con: node scripts/generate-password-hash.ts "MiContraseñaSegura"

async function generatePasswordHash(password: string): Promise<string> {
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

const password = process.argv[2]
if (!password) {
  console.error("Uso: node scripts/generate-password-hash.ts <contraseña>")
  process.exit(1)
}

generatePasswordHash(password).then((hash) => {
  console.log("Hash generado:")
  console.log(hash)
})
