import { defineConfig } from "drizzle-kit"

// drizzle-kit no carga .env.local por su cuenta: ejecutar con
// `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs <comando>`
// (o los scripts db:* de package.json). Usa la conexión directa (sin pooler)
// porque las migraciones necesitan una sesión estable.
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!,
  },
  // Tablas legacy sin uso en el código (ver docs/database-schema.md)
  tablesFilter: ["!facturas_proveedor", "!factura_items", "!playing_with_neon"],
})
