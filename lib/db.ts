import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

// Cliente SQL crudo que todavía usan las rutas de autenticación del portal y
// el diseño con IA. El resto del sistema usa Drizzle (server/db/client.ts).
export const sql = neon(process.env.DATABASE_URL)
