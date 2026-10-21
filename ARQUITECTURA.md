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
- `/admin/envios`: envíos, guías de Servientrega (API) y cuenta de Servientrega.
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
- El IVA del pedido se calcula **sobre la base gravada** (método compatible con el SRI): IVA = round(Σ subtotales de las líneas que gravan × 15 %), en centavos y half-up. `pedidos.total` = Σ subtotales + ese IVA. Una sola función pura, `calcularTotales` en `lib/iva.ts` (→ subtotal, subtotal 0 %, base gravada, IVA, total), la usan `recalcularTotalPedido`, el checkout del catálogo, la factura, el carrito, el modal de checkout y el detalle del pedido en el admin, así cliente y servidor calculan igual.
- Cada línea del pedido copia el flag al agregarse y guarda en `pedido_items.iva` su IVA redondeado por línea, **solo como dato informativo**: la suma de esos valores puede diferir en centavos del IVA del pedido. El **total del pedido incluye el IVA**: cobros, saldo, cierre y factura cuadran con el mismo número.
- La factura desglosa Subtotal 15 % (base gravada), Subtotal 0 %, IVA 15 % (= round(base × 0,15)) y Total (= `pedidos.total`, que `generarFactura` verifica). El IVA no es ingreso: el dashboard ("Ventas del mes" y "Ventas por mes") muestra ventas **netas** (`pedidos.total` − IVA del pedido, igual a Σ subtotales) y, como dato secundario, el total con IVA. Los cobros, la consolidación mensual de pagos (`total_pedidos`, que se compara con los cobros) y el reporte de cobros siguen con IVA, que es lo que paga el cliente.
- Los pedidos anteriores a la migración `0003` quedaron sin IVA en sus líneas y conservan su total histórico.

## Seguridad

- **Sesiones:** JWT HS256 firmado con `jose` (`lib/jwt.ts`), en cookies `httpOnly`, `sameSite=lax` y `secure` en producción. Duran 24 h en el panel admin y 7 días en el portal (`ADMIN_SESSION_SECONDS` / `PORTAL_SESSION_SECONDS`).
  - Los tokens llevan audiencia (`admin` / `portal`): uno del portal no sirve en el admin ni al revés.
  - También llevan `tv` (token_version): desactivar un usuario, cambiarle el rol o resetear su contraseña incrementa la versión y revoca sus sesiones abiertas. El logout (admin y portal) también la incrementa, así un token copiado deja de valer al cerrar sesión (cierra todas las sesiones de esa cuenta).
  - **Contraseñas asignadas por otra persona** (alta de usuario por soporte o un administrador, reseteo, `scripts/create-admin.ts`): el usuario queda con `debe_cambiar_password`. Hasta cambiarla, `proxy.ts` y `requireUser` lo llevan a `/cambiar-password` y `withAuth`/`adminAction` responden 403. Al cambiarla se limpia la marca y se incrementa `token_version`.
  - `JWT_SECRET` es distinto en Production y en Preview/Development.
- **Contraseñas:** PBKDF2-SHA256 con 600 000 iteraciones y salt aleatorio, vía Web Crypto (`lib/password.ts`), comparadas en tiempo constante. El hash lleva versión (`pbkdf2-sha256$<iteraciones>$<salt>$<hash>`); los antiguos (`salt:hash`, 100 000 iteraciones) siguen verificando y se re-hashean en el siguiente login correcto.
- **Proxy (`proxy.ts`):** protege `/admin/*` (autenticación y rol) y `/cambiar-password`. Las rutas `/api/*` quedan fuera, así que **cada route handler valida su propia autenticación** con `withAuth`/`withCliente`. Ambos verifican además `activo` y `tv` contra la base.
- **Rate limiting** (`lib/rate-limit.ts`; Upstash en producción, memoria en desarrollo): login del admin y del portal (por IP y, además, por cuenta), registro, recuperación y reseteo de contraseña, y diseño por IA.
  - El límite **por cuenta** (`conLimiteFallos`) cuenta solo **fallos**: antes de verificar la contraseña solo consulta el contador, lo incrementa tras un login fallido y un login correcto lo resetea (20 fallos por hora por email normalizado, desde cualquier IP). Así nadie puede bloquear al dueño legítimo con POST al azar. El límite por IP sigue contando todas las peticiones.
  - El cambio de la propia contraseña (`/cambiar-password` del admin y el del portal) usa la misma semántica por usuario/cliente: 10 intentos con la contraseña actual incorrecta por hora responden 429; un cambio correcto resetea el contador.
- **Registro del portal:** un cliente existente con la misma cédula se vincula solo si coincide el email. Si solo coincide el teléfono no se vincula: queda un ticket para que la tienda lo verifique (uno solo mientras siga abierto, es decir, con estado distinto de `resuelto` o `cerrado`). Los choques (cédula con cuenta, email usado) responden el mismo mensaje genérico, y la respuesta no devuelve datos del cliente existente.
- **Errores:** los route handlers responden mensajes genéricos (`apiError`). El detalle va a `lib/logger.ts`, que en el servidor lo reenvía a Sentry.
- **Upload:** valida el tipo real de la imagen por sus magic bytes y exige el permiso `productos/update`.
- **Recuperación de contraseña (portal):** token aleatorio de 32 bytes con vencimiento de 1 h. El enlace se entrega por un ticket de soporte que se reenvía por WhatsApp, y nunca aparece en la respuesta de la API.
- **Auditoría** (`lib/audit.ts`): registra logins (exitosos y fallidos) y acciones críticas en la base de datos, incluido el rol asignado al crear un usuario y el anterior y el nuevo en cada cambio de rol. Solo la consulta el rol soporte.

## Base de datos

- PostgreSQL en Neon con Drizzle ORM (`server/db`): `db` (HTTP) para lecturas y `withTx` (Pool/WebSocket) para transacciones. El stock se descuenta de forma atómica dentro de la transacción del pedido.
- Las migraciones están en `drizzle/` y se aplican con drizzle-kit: `0000_baseline` (schema), `0001_datos_referencia`, `0002_servientrega_envio_unico`, `0003_ronda_3` (IVA por ítem, `usuarios.debe_cambiar_password`, emails únicos por `lower(email)`) y `0004_servientrega_api` (guía de Servientrega en `envios` y `servientrega_rotulos`). Los `scripts/0xx-*.sql` son historial previo. Los scripts destructivos están en `scripts/dangerous/`.
- Bases:
  - `mdlt-prod`: Production.
  - `mdlt-preview`: Preview y Development. Tiene el marcador `_entorno = 'preview'` que exigen los scripts de seed.
- El esquema está documentado en `docs/database-schema.md`.
- Los códigos de pedido (`TUTU-YYYY-####`) salen de una secuencia de Postgres por año, que es atómica.

## Integración Servientrega

Generación de guías con la API de Servientrega (Servicli). Referencia de la API y formatos reales: [`docs/servientrega-api.md`](docs/servientrega-api.md).

- **Flujo**: en la tarjeta de envío del pedido y en la lista de Envíos, el botón manual "Generar guía Servientrega" abre un diálogo con la ciudad de destino (combobox sobre las ciudades de Servientrega, preseleccionada con una sugerencia a partir de `pedidos.ciudad_envio` o la dirección del cliente), el destinatario precargado y editable, peso (0.5 kg), piezas (1), contenido, valor de la mercancía (subtotal de productos) y producto (2, Mercancía Premier). Con la guía generada se muestran su número, "Descargar guía (PDF)", "Rótulo" y "Anular guía". El registro manual de una guía hecha en el portal sigue disponible.
- **Capas**: `server/integraciones/servientrega/` (config con Zod, transporte HTTPS, mapper y cliente), `server/services/servientrega.ts` (reglas, permisos y auditoría), Server Actions en `app/(admin)/admin/envios/actions.ts`, descarga de PDF en `app/api/envios/[id]/guia-servientrega` (`?tipo=a4|rotulo`) y componentes en `components/admin/envios/`. Las constantes y funciones puras compartidas con el cliente están en `lib/servientrega.ts`.
- **Configuración**: `SERVIENTREGA_AMBIENTE` (`qa`/`prod`), credenciales y datos del remitente (ver `README.md`). Sin `SERVIENTREGA_AMBIENTE` la integración queda deshabilitada: los botones aparecen deshabilitados con el mensaje "Integración con Servientrega no configurada" y el resto de la app funciona igual. Si faltan datos del remitente, solo falla la generación, con un mensaje que lista las variables.
- **Datos**: la guía real va en `envios.guia_servientrega` (UNIQUE parcial), con `servientrega_estado` (`generando`/`generada`/`anulada`) y los datos usados. La guía interna `envios.guia` (`SER-YYYY-######`) no cambia. El rótulo se guarda en `servientrega_rotulos` la primera vez, porque Servientrega lo entrega una sola vez.
- **Una guía por envío**: una transacción corta con `SELECT … FOR UPDATE` marca el envío como `generando`; la llamada a la API va fuera de la transacción (hasta 20 s de red sin un bloqueo ni una conexión abiertos) y luego un `UPDATE` condicionado a `generando` guarda el número. Una petición simultánea encuentra la marca y recibe 409; si la API falla, se restaura el estado anterior, y una marca de más de 2 minutos se considera abandonada. Si la API responde OK pero falla el `UPDATE`, el número de guía queda en el log (`logger.error`) y en el mensaje al admin. Un timeout al generar es ambiguo (la guía pudo crearse igual): el mensaje pide revisar el portal (referencia "Pedido TUTU-…") antes de reintentar.
- **Seguridad**: las URLs de la API llevan usuario y contraseña en la ruta, así que nunca se loguean; todo texto que va al log pasa por `redactar()`. En QA, que se publica por IP, el certificado se valida contra `servientrega.com.ec` (SNI + `checkServerIdentity`), sin desactivar TLS. Timeout de 20 s y un reintento solo en GET. Permisos: módulo `envios` con `update` para generar y anular, y `read` para descargar. Generar y anular quedan en la auditoría.
- **Ciudades**: cache en memoria de 24 h por instancia (sin `cacheComponents`, `"use cache"` no está disponible).
- **QA**: la anulación respondió siempre "LA GUÍA NO PUEDE SER ANULADA, PORQUE ESTA SIENDO PROCESADA", con la guía impresa o sin imprimir. El sistema muestra ese mensaje al admin y la guía sigue vigente.

### IP fija y Vercel Hobby

Producción de Servientrega (`swservicli.servientrega.com.ec`) solo atiende IPs públicas registradas. Las funciones de Vercel salen por IPs dinámicas y compartidas, y el plan Hobby no ofrece IP fija, así que **producción no se activa por ahora** (`SERVIENTREGA_AMBIENTE` sin configurar en Production). El código ya soporta `prod`. Opciones:

1. **Proxy con IP fija**: un servidor pequeño (un VPS o un servicio de proxy de salida con IP estática) que reenvíe las llamadas a Servientrega; se registra su IP. Hay que autenticar el proxy y mantenerlo, y suma un salto de red.
2. **Pedir una excepción a Servientrega**: que habiliten el acceso sin IP fija o por otro mecanismo (token, rango de IPs). Depende de su política.
3. **Vercel Pro con Static IPs**: IPs de salida fijas para las funciones del proyecto, que se registran en Servientrega. No requiere infraestructura extra, pero tiene el costo del plan Pro y del add-on.

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
