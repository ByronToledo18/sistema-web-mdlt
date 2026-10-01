# Tests y CI

## Vitest (`pnpm test`)

Corre sin base de datos ni secretos, así que se puede ejecutar en cualquier máquina y en CI.

- **`tests/services/`**: los servicios de `server/services` contra **PGlite**, un Postgres real compilado a WASM que vive en memoria. `vitest.config.mts` reemplaza `@/server/db/client` por `tests/support/db-client.ts`. Ese archivo crea una PGlite por archivo de test, le aplica las migraciones de `drizzle/` y exporta los mismos `db` y `withTx`. Cada test empieza con `resetDb()`, que vacía las tablas y reinicia los ids y las secuencias por año.
- **`tests/unit/`**: la matriz de permisos completa (rol × módulo × acción, más `canAccessRoute`), el guard `withAuth` (401, 403, 400 por Zod, `HttpError` y 500 sin detalles) y los validadores Zod.

Qué cubre:

- **Checkout del catálogo:**
  - Los precios salen de la base, no del navegador.
  - Si falta stock, se hace rollback completo.
  - Si hay dos compras de la última unidad, solo una se concreta.
  - El envío se cobra según la tarifa.
  - Los códigos de pedido son correlativos.
- **Ítems:**
  - El stock se descuenta, se ajusta por diferencia y se devuelve una sola vez.
  - Un pedido cerrado solo lo modifica el administrador.
- **Cobros:**
  - Nunca superan el saldo. La comparación se hace en centavos.
  - El cobro que completa el saldo crea el envío.
- **Compras a proveedores:** stock, IVA, rollback, anulación y pagos.
- **Usuarios:** no se puede quedar el sistema sin un administrador o un usuario de soporte activo.

**Limitación:** PGlite tiene una sola conexión, así que las transacciones "concurrentes" se ejecutan una tras otra. Los tests de concurrencia verifican el resultado (nadie vende la última unidad dos veces), no el bloqueo de filas de Neon.

Si un test de servicio necesita datos, se agregan helpers en `tests/support/fixtures.ts`.

## Playwright (`pnpm test:e2e`)

Hay tres flujos en `e2e/`:

1. **Catálogo:** registro → carrito → checkout.
2. **Admin:** login → crear pedido → registrar pago.
3. **Portal:** recuperar contraseña → el ticket aparece en soporte.

Los selectores van por rol y texto visible, nunca por las llamadas a `/api`.

**Nunca se corren contra producción, porque crean datos.** Para correrlos:

1. Crear una rama de Neon de test y aplicarle las migraciones.
2. En `.env.test.local`, definir `TEST_DATABASE_URL=<url de esa rama>`.
3. Ejecutar `pnpm db:seed-test`. Crea los usuarios E2E (admin y soporte), un cliente del portal, un producto con mucho stock, el servicio "Envío" y una tarifa. Las contraseñas son aleatorias y quedan en `.env.e2e.local`, que está en `.gitignore`.
4. Correr una de estas dos opciones:
   - `pnpm test:e2e` con `pnpm dev` apuntando a esa misma rama (`DATABASE_URL` = rama de test).
   - `E2E_BASE_URL=<url del preview> pnpm test:e2e`.

## CI (`.github/workflows/`)

- **`ci.yml`:** corre en cada PR y en cada push a `main`. Ejecuta `pnpm install --frozen-lockfile`, `typecheck`, `lint` y `test`.
- **`e2e.yml`:** es opcional. Corre cuando Vercel termina un deploy de preview (`deployment_status`), siembra la base de test y ejecuta Playwright contra la URL del preview. Para activarlo:
  - La variable de repositorio `E2E_ENABLED=true`.
  - El secreto `TEST_DATABASE_URL`, que debe ser la misma rama que usa el preview.
  - Si el preview tiene Deployment Protection, el secreto `VERCEL_AUTOMATION_BYPASS_SECRET`.
