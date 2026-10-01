# Sistema Web - El Mundo de las Tutus

Sistema de gestión integral para el emprendimiento "El Mundo de las Tutus", especializado en confección y comercialización de tutús y prendas personalizadas.

## Características

- **Catálogo público** con carrito, checkout y diseño personalizado por IA (Gemini)
- **Portal de clientes**: registro, login, historial de pedidos, perfil y recuperación de contraseña
- **Gestión de Pedidos**: seguimiento con ID único (`TUTU-YYYY-####`), ítems, facturas
- **Inventario**: productos y servicios con precios variables, imágenes en Vercel Blob
- **Pagos**: registro de abonos, consolidación y reportes mensuales
- **Envíos**: integración con Servientrega (cuenta mensual y pagos)
- **Proveedores**: facturas de compra y pagos
- **Nómina**: pagos a costureras
- **Soporte**: usuarios, roles, tickets y auditoría
- **Autenticación**: JWT en cookie httpOnly con 3 roles internos (Administrador, Asistente, Soporte)

## Stack

Next.js 16 (App Router, Server Components + Server Actions) · React 19 · TypeScript · Drizzle ORM + Zod · Tailwind CSS 4 + shadcn/ui · PostgreSQL (Neon) · Vercel Blob · Upstash (rate limiting) · Sentry · Google Gemini · Vercel · Vitest + Playwright

## Requisitos previos

- Node.js 22+
- pnpm 11 (si Corepack falla, usar `npx pnpm@11.24.0 <comando>`)
- Base de datos PostgreSQL en Neon
- Proyecto en Vercel (Blob y, opcionalmente, Upstash Redis)

## Instalación

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/ByronToledo18/sistema-web-mdlt.git
   cd sistema-web-mdlt
   ```

2. Instalar dependencias:

   ```bash
   pnpm install
   ```

3. Configurar variables de entorno en `.env.local` (nunca commitear valores reales). Con el proyecto vinculado en Vercel se pueden traer con `vercel env pull .env.local`.

   | Variable | Requerida | Uso |
   |---|---|---|
   | `DATABASE_URL` | Sí | Conexión a Neon (`postgresql://…?sslmode=require`) |
   | `JWT_SECRET` | Sí | Firma de los tokens de sesión. Valor aleatorio largo, distinto por ambiente |
   | `BLOB_READ_WRITE_TOKEN` | Sí | Subida de imágenes a Vercel Blob |
   | `GEMINI_API_KEY` | Sí (catálogo IA) | Generación de diseños personalizados |
   | `NEXT_PUBLIC_APP_URL` | Recomendada | URL pública, usada en los enlaces de recuperación de contraseña |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) | En producción | Rate limiting. En desarrollo hay un respaldo en memoria |

4. Aplicar las migraciones de Drizzle (`drizzle/`): crean el schema completo y cargan los datos de referencia (roles, tarifas de envío y el servicio "Envío").

   ```bash
   pnpm db:migrate
   ```

   Los `scripts/0xx-*.sql` son el historial previo a Drizzle; ya están incluidos en `drizzle/0000_baseline.sql` y no se ejecutan en bases nuevas.
   > ⚠️ `scripts/dangerous/` contiene scripts que **borran datos**. No son migraciones.

5. Iniciar el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

## Crear el usuario administrador

No hay credenciales por defecto. Este script crea (o resetea) los usuarios internos con una contraseña aleatoria:

```bash
pnpm db:create-admin
```

Crea `admin@` y `soporte@`; requiere las migraciones aplicadas. Las contraseñas se imprimen una sola vez en la consola: guárdalas de inmediato. Para producción, ver [`docs/deploy-produccion.md`](docs/deploy-produccion.md).

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Verificación de tipos (`tsc --noEmit`) |
| `pnpm test` | Tests de servicios y unitarios (Vitest + PGlite; en local, usar `--maxWorkers=1`) |
| `pnpm test:e2e` | Flujos e2e con Playwright (ver [`docs/testing.md`](docs/testing.md)) |
| `pnpm db:generate` / `pnpm db:migrate` | Generar / aplicar migraciones de Drizzle |
| `pnpm db:create-admin` | Crear o resetear los usuarios internos |
| `pnpm db:seed-test` | Datos de prueba para los e2e (solo en bases con el marcador `_entorno = 'preview'`) |

## Estructura del proyecto

```
app/
├── (admin)/admin/     # Panel administrativo: Server Components + Server Actions por módulo
├── (public)/catalogo/ # Catálogo público (ISR) + diseño por IA
├── (portal)/portal/   # Portal de clientes (login, registro, pedidos, perfil, contraseña)
├── api/               # Route handlers: auth, catalogo, portal, upload y reportes
├── login/             # Login del personal interno
└── page.tsx           # Redirección al catálogo
components/
├── ui/                # Componentes shadcn/ui
├── admin/             # Formularios y diálogos cliente del admin
├── catalog/           # Carrito, checkout, mapa
└── dashboard/         # Header y sidebar del admin
server/
├── db/                # Schema de Drizzle y cliente (db + withTx)
├── services/          # Lógica de negocio, con transacciones
├── validators/        # Esquemas Zod
├── auth/              # withAuth (API), sesión y adminAction (Server Actions)
└── reportes/          # Exportes a Excel y PDF
lib/                   # jwt, auth, password, permisos, rate limit, logger y Sentry
drizzle/               # Migraciones (0000 baseline, 0001 datos de referencia)
tests/ · e2e/          # Vitest (servicios y unit) y Playwright
scripts/               # create-admin, seed-test e historial SQL previo a Drizzle
docs/                  # Esquema, testing y despliegue
proxy.ts               # Protección de rutas /admin por rol (antes middleware.ts)
```

## Roles de usuario

| Rol | Acceso |
|---|---|
| **Administrador** | Dashboard, pedidos, clientes, inventario, pagos, envíos, proveedores y nómina |
| **Asistente** | Dashboard, pedidos, clientes, inventario y envíos |
| **Soporte técnico** | Dashboard y panel de soporte (usuarios, tickets, auditoría) |

Los clientes del catálogo usan una sesión separada (portal), sin acceso al admin.

## Base de datos

PostgreSQL en Neon. Tablas principales: `roles`, `usuarios`, `clientes`, `productos`, `servicios`, `pedidos`, `pedido_items`, `pedido_facturas`, `pagos`, `envios`, `tarifas_envio`, `servientrega_cuenta`, `servientrega_detalle`, `proveedores`, `facturas_proveedor`, `nomina_mov`, `tickets`, `auditoria`, `disenos_personalizados`. El detalle está en [`docs/database-schema.md`](docs/database-schema.md).

Propietario: El Mundo de las Tutus
