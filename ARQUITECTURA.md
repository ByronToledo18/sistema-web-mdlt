# Arquitectura del Sistema - El Mundo de las Tutus

## Visión general

Una sola aplicación Next.js (App Router) desplegada en Vercel, con **tres áreas** separadas por ruta y por sesión:

| Área | Ruta base | Autenticación |
|---|---|---|
| Catálogo público | `/catalogo` | Ninguna para navegar. El checkout y el diseño por IA requieren sesión de cliente |
| Portal de clientes | `/portal` | Cookie `portal-auth-token` (JWT de cliente) |
| Administración | `/admin` | Cookie `auth-token` (JWT de usuario interno con rol) |

Las tres áreas comparten la base de datos y los route handlers de `app/api/`.

### 1. Catálogo público
- Productos y servicios, carrito y checkout (`/api/catalogo/*`).
- Diseño personalizado por IA con Gemini (`/catalogo/disenar`), con un límite diario por cliente.
- El precio y el costo de envío **siempre se recalculan en el servidor**. No se confía en los valores que manda el cliente.
- Contacto y recuperación de contraseña vía WhatsApp (`lib/whatsapp.ts`).

**Rutas públicas:** `/` (redirige al catálogo), `/catalogo`, `/login` (personal interno) y `/portal/login`, `/portal/registro`, `/portal/recuperar-password`, `/portal/reset-password`.

### 2. Portal de clientes
- `/portal/pedidos`: historial y estado de los pedidos del cliente.
- `/portal/perfil`: datos personales y cambio de contraseña.

### 3. Administración
- `/admin/dashboard`: panel principal.
- `/admin/pedidos` y `/admin/pedidos/[id]`: pedidos, ítems, pagos, envío y factura.
- `/admin/clientes`: clientes.
- `/admin/inventario`: productos y servicios.
- `/admin/pagos`: pagos, consolidación y reportes.
- `/admin/envios`: envíos y cuenta de Servientrega.
- `/admin/proveedores` y `/admin/proveedores/[id]/facturas`: proveedores y facturas de compra.
- `/admin/nomina`: nómina de costureras.
- `/admin/soporte`: usuarios, tickets y auditoría.

## Roles de usuario (personal interno)

`lib/permissions.ts` es la única fuente de verdad: define el permiso por rol × módulo × acción y `ROUTE_MODULES` (ruta → módulo). Lo usan `proxy.ts` (páginas), `withAuth` en los route handlers, `requirePermission`/`adminAction` en Server Components y Server Actions, y el sidebar.

| Módulo | Administrador | Asistente | Soporte |
|---|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ |
| Pedidos | ✅ | ✅ (sin reabrir pedidos cerrados) | — |
| Clientes | ✅ | ✅ | — |
| Inventario | ✅ | ✅ | — |
| Envíos | ✅ | ✅ | — |
| Pagos | ✅ | — (página) | — |
| Proveedores | ✅ | — | — |
| Nómina | ✅ | — | — |
| Soporte (usuarios, tickets, auditoría) | — (página) | — | ✅ |

> Decisiones de negocio: el asistente no ve la página de Cobros, y soporte puede crear administradores (con controles: la auditoría guarda el rol asignado y el usuario nuevo debe cambiar su contraseña al ingresar).
>
> Pedidos cerrados (terminado, entregado, anulado): nadie, ni el administrador, agrega, edita o elimina ítems ni elimina cobros. Para corregir uno, el administrador primero lo reabre (cambio de estado); para volver a cerrarlo se exige saldo cero.

## IVA

- Los precios del catálogo **no incluyen IVA**. Cada producto y servicio (también "Envío") tiene el switch "Grava IVA" (`graba_iva`, por defecto activo).
- La tarifa (15 %) vive solo en `lib/iva.ts`, que usan los pedidos, la factura, el checkout y las facturas de proveedores.
- Cada línea del pedido copia el flag al agregarse y guarda su IVA redondeado a centavos. El **total del pedido incluye el IVA**: cobros, saldo, cierre y factura cuadran con el mismo número.
- La factura desglosa Subtotal 15 %, Subtotal 0 %, IVA 15 % y Total (= `pedidos.total`). El dashboard y los reportes suman `pedidos.total`, con IVA.
- Los pedidos anteriores a la migración `0003` quedaron sin IVA en sus líneas y conservan su total histórico.

## Seguridad

- **Sesiones:** JWT HS256 firmado con `jose` (`lib/jwt.ts`), en cookies `httpOnly`, `sameSite=lax` y `secure` en producción. Duran 24 h en el panel admin y 7 días en el portal (`ADMIN_SESSION_SECONDS` / `PORTAL_SESSION_SECONDS`).
  - Los tokens llevan audiencia (`admin` / `portal`): uno del portal no sirve en el admin ni al revés.
  - También llevan `tv` (token_version): desactivar un usuario, cambiarle el rol o resetear su contraseña incrementa la versión y revoca sus sesiones abiertas. El logout (admin y portal) también la incrementa, así un token copiado deja de valer al cerrar sesión (cierra todas las sesiones de esa cuenta).
  - **Contraseñas asignadas por otra persona** (alta de usuario por soporte o un administrador, reseteo, `scripts/create-admin.ts`): el usuario queda con `debe_cambiar_password`. Hasta cambiarla, `proxy.ts` y `requireUser` lo llevan a `/cambiar-password` y `withAuth`/`adminAction` responden 403. Al cambiarla se limpia la marca y se incrementa `token_version`.
  - `JWT_SECRET` es distinto en Production y en Preview/Development.
- **Contraseñas:** PBKDF2-SHA256 con 600 000 iteraciones y salt aleatorio, vía Web Crypto (`lib/password.ts`), comparadas en tiempo constante. El hash lleva versión (`pbkdf2-sha256$<iteraciones>$<salt>$<hash>`); los antiguos (`salt:hash`, 100 000 iteraciones) siguen verificando y se re-hashean en el siguiente login correcto.
- **Proxy (`proxy.ts`):** protege `/admin/*` (autenticación y rol) y `/cambiar-password`. Las rutas `/api/*` quedan fuera, así que **cada route handler valida su propia autenticación** con `withAuth`/`withCliente`. Ambos verifican además `activo` y `tv` contra la base.
- **Rate limiting** (`lib/rate-limit.ts`; Upstash en producción, memoria en desarrollo): login del admin y del portal (por IP y, además, por cuenta: 10 intentos cada 15 min por email normalizado), registro, recuperación y reseteo de contraseña, y diseño por IA.
- **Registro del portal:** un cliente existente con la misma cédula se vincula solo si coincide el email. Si solo coincide el teléfono no se vincula: queda un ticket para que la tienda lo verifique. Los choques (cédula con cuenta, email usado) responden el mismo mensaje genérico, y la respuesta no devuelve datos del cliente existente.
- **Errores:** los route handlers responden mensajes genéricos (`apiError`). El detalle va a `lib/logger.ts`, que en el servidor lo reenvía a Sentry.
- **Upload:** valida el tipo real de la imagen por sus magic bytes y exige el permiso `productos/update`.
- **Recuperación de contraseña (portal):** token aleatorio de 32 bytes con vencimiento de 1 h. El enlace se entrega por un ticket de soporte que se reenvía por WhatsApp, y nunca aparece en la respuesta de la API.
- **Auditoría** (`lib/audit.ts`): registra logins (exitosos y fallidos) y acciones críticas en la base de datos, incluido el rol asignado al crear un usuario y el anterior y el nuevo en cada cambio de rol. Solo la consulta el rol soporte.

## Base de datos

- PostgreSQL en Neon con Drizzle ORM (`server/db`): `db` (HTTP) para lecturas y `withTx` (Pool/WebSocket) para transacciones. El stock se descuenta de forma atómica dentro de la transacción del pedido.
- Las migraciones están en `drizzle/` y se aplican con drizzle-kit: `0000_baseline` (schema), `0001_datos_referencia`, `0002_servientrega_envio_unico` y `0003_ronda_3` (IVA por ítem, `usuarios.debe_cambiar_password`, emails únicos por `lower(email)`). Los `scripts/0xx-*.sql` son historial previo. Los scripts destructivos están en `scripts/dangerous/`.
- Bases:
  - `mdlt-prod`: Production.
  - `mdlt-preview`: Preview y Development. Tiene el marcador `_entorno = 'preview'` que exigen los scripts de seed.
- El esquema está documentado en `docs/database-schema.md`.
- Los códigos de pedido (`TUTU-YYYY-####`) salen de una secuencia de Postgres por año, que es atómica.

## Despliegue

- Un único proyecto en Vercel: los route groups separan las áreas sin necesidad de dos despliegues.
- Si se quiere un subdominio privado para el admin (ej. `admin.elmundodelastutus.com`), se resuelve con un rewrite por host en `proxy.ts`, dentro de la misma app.
- El catálogo usa ISR (revalidate de 60 s) y se revalida on-demand cuando el admin edita productos o servicios.
- Procedimiento de despliegue a producción: [`docs/deploy-produccion.md`](docs/deploy-produccion.md).

## Stack tecnológico

- **Frontend:** Next.js 16 (App Router, Server Components), React 19, TypeScript.
- **Backend:** Server Actions (admin), route handlers (API pública y portal), servicios en `server/services` con Zod.
- **ORM:** Drizzle.
- **Observabilidad:** Sentry (`@sentry/nextjs`), conectado a `lib/logger.ts`.
- **Tests:** Vitest + PGlite (servicios) y Playwright (e2e); CI en GitHub Actions.
- **Base de datos:** PostgreSQL (Neon).
- **Autenticación:** JWT (`jose`) + PBKDF2 (Web Crypto).
- **Archivos:** Vercel Blob.
- **IA:** Google Gemini (`@google/genai`).
- **UI:** shadcn/ui (Radix) + Tailwind CSS 4.
- **Despliegue:** Vercel.
