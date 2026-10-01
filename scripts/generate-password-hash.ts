// Genera un hash de contraseña en el formato de lib/password.ts (el mismo que
// usan hashPassword/verifyPassword).
// Ejecutar con: node --import tsx scripts/generate-password-hash.ts "MiContraseñaSegura"

import { hashPassword } from "@/lib/password"

const password = process.argv[2]
if (!password) {
  console.error('Uso: node --import tsx scripts/generate-password-hash.ts "MiContraseñaSegura"')
  process.exit(1)
}

hashPassword(password).then((hash) => console.log(hash))
