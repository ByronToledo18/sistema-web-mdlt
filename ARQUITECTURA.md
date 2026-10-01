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

El acceso a las páginas lo define `roleRoutes` en `middleware.ts`. Cada route handler valida además el rol con `requireAuth([...])`.

| Módulo | Administrador | Asistente | Soporte |
|---|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ |
| Pedidos | ✅ | ✅ (sin modificar pedidos cerrados) | — |
| Clientes | ✅ | ✅ | — |
| Inventario | ✅ | ✅ | — |
| Envíos | ✅ | ✅ | — |
| Pagos | ✅ | — (página) | — |
| Proveedores | ✅ | — | — |
| Nómina | ✅ | — | — |
| Soporte (usuarios, tickets, auditoría) | — (página) | — | ✅ |

> Hay discrepancias conocidas entre páginas y APIs. Por ejemplo, la API `/api/pagos` acepta al asistente aunque la página no, y las APIs de soporte aceptan al administrador. `lib/permissions.ts` todavía no se usa. En la Fase 2 del plan de trabajo los permisos pasan a una única fuente de verdad.

## Seguridad

- **Sesiones:** JWT HS256 firmado con `jose`, en cookies `httpOnly`, `sameSite=lax` y `secure` en producción. Duran 24 h.
- **Contraseñas:** PBKDF2-SHA256 con 100 000 iteraciones y salt aleatorio, vía Web Crypto (`lib/auth.ts`).
- **Middleware:** protege `/admin/*` (autenticación y rol). Las rutas `/api/*` quedan excluidas del middleware, así que **cada route handler debe validar su propia autenticación**.
- **Recuperación de contraseña (portal):** token aleatorio de 32 bytes con vencimiento de 1 h. El enlace se entrega por un ticket de soporte que se reenvía por WhatsApp, y nunca aparece en la respuesta de la API.
- **Auditoría** (`lib/audit.ts`): registra logins (exitosos y fallidos) y acciones críticas en la base de datos. Solo la consulta el rol soporte.

## Base de datos

- PostgreSQL en Neon, con conexión mediante `@neondatabase/serverless` (`lib/db.ts`).
- Las migraciones son SQL numeradas en `scripts/` y se aplican en orden. Los scripts destructivos están en `scripts/dangerous/`.
- El esquema está documentado en `docs/database-schema.md`.
- Los códigos de pedido (`TUTU-YYYY-####`) salen de una secuencia de Postgres por año, que es atómica.

## Despliegue

- Un único proyecto en Vercel: los route groups separan las áreas sin necesidad de dos despliegues.
- Si se quiere un subdominio privado para el admin (ej. `admin.elmundodelastutus.com`), se resuelve con un rewrite por host en el middleware, dentro de la misma app. No se recomienda partir el proyecto en dos aplicaciones con este tamaño.

## Stack tecnológico

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript.
- **Backend:** route handlers de Next.js.
- **Base de datos:** PostgreSQL (Neon).
- **Autenticación:** JWT (`jose`) + PBKDF2 (Web Crypto).
- **Archivos:** Vercel Blob.
- **IA:** Google Gemini (`@google/genai`).
- **UI:** shadcn/ui (Radix) + Tailwind CSS 4.
- **Despliegue:** Vercel.
