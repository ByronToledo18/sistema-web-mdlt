import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      // Los servicios usan una base PGlite en memoria en lugar de Neon
      // (ver tests/support/db-client.ts). Va antes del alias "@/".
      { find: /^@\/server\/db\/client$/, replacement: `${root}tests/support/db-client.ts` },
      // "server-only" lanza fuera de un Server Component de Next.
      { find: /^server-only$/, replacement: `${root}tests/support/empty.ts` },
      { find: /^@\//, replacement: root },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Cada archivo levanta su propia PGlite (Postgres en WASM) y aplica las
    // migraciones; con muchos workers a la vez se queda sin memoria.
    maxWorkers: 2,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
