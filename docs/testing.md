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

**Nunca se corren contra producción, porque crean datos.** Se usa la base de pruebas **mdlt-preview** (la de Preview y Development en Vercel). Esa base tiene un marcador, la tabla `_entorno` con una única fila `'preview'`. Producción no lo tiene y no debe tenerlo.

1. `.env.local` apuntando a mdlt-preview: `npx vercel env pull .env.local --environment=development`. Otra opción es poner `TEST_DATABASE_URL` en `.env.test.local`.
2. `pnpm db:seed-test`. **Aborta sin escribir nada si la base no tiene el marcador.** Como chequeo adicional, también aborta si coincide con `PROD_DATABASE_URL`, cuando esa variable existe. El seed crea:
   - los usuarios E2E (admin y soporte)
   - un cliente del portal
   - un producto con mucho stock
   - el servicio "Envío" y una tarifa

   Las contraseñas son aleatorias y quedan en `.env.e2e.local`, que está en `.gitignore`.
3. Correr una de estas dos opciones:
   - **`pnpm test:e2e`:** hace `next build` y `next start` en el puerto 3002 (`E2E_PORT`), con la base de `.env.local`. No usa `next dev`, porque compila cada ruta en la primera visita y se queda sin memoria.
   - **`E2E_BASE_URL=<url> pnpm test:e2e`:** corre contra un servidor que ya esté levantado o contra un preview de Vercel.

**Rate limit:** cada test manda una IP propia en `x-forwarded-for` (fixture en `e2e/helpers.ts`), así los límites de login y registro no se acumulan entre tests contra un servidor local. En Vercel la plataforma reescribe esa cabecera y el límite se aplica igual que en producción. No hay reintentos automáticos, porque cada intento repite logins.

## CI (`.github/workflows/`)

- **`ci.yml`:** corre en cada PR y en cada push a `main`. Ejecuta `pnpm install --frozen-lockfile`, `typecheck`, `lint` y `test`.
- **`e2e.yml`:** es opcional. Corre cuando Vercel termina un deploy de preview (`deployment_status`), siembra la base de test y ejecuta Playwright contra la URL del preview. Para activarlo:
  - La variable de repositorio `E2E_ENABLED=true`.
  - El secreto `TEST_DATABASE_URL`, que debe ser la misma rama que usa el preview.
  - Si el preview tiene Deployment Protection, el secreto `VERCEL_AUTOMATION_BYPASS_SECRET`.
