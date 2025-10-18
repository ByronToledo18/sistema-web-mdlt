# Arquitectura del Sistema - El Mundo de las Tutus

## Separación de Aplicaciones

Este proyecto está dividido en **dos aplicaciones independientes** por razones de seguridad y rendimiento:

### 1. **Aplicación Pública** (Catálogo)
- **Ruta base**: `/catalogo`
- **Propósito**: Mostrar productos y servicios a clientes potenciales
- **Características**:
  - Sin autenticación requerida
  - Optimizada para imágenes y contenido visual
  - Integración directa con WhatsApp
  - SEO optimizado
  - Carga rápida y responsive

**Rutas públicas:**
- `/` - Redirección al catálogo
- `/catalogo` - Catálogo de productos y servicios
- `/login` - Acceso al sistema administrativo

### 2. **Aplicación Administrativa** (Dashboard)
- **Ruta base**: `/admin`
- **Propósito**: Gestión interna del negocio
- **Características**:
  - Requiere autenticación JWT
  - Control de acceso basado en roles
  - Gestión de pedidos, clientes, inventario, pagos, envíos
  - Panel de soporte técnico
  - Auditoría de acciones

**Rutas administrativas:**
- `/admin/dashboard` - Panel principal
- `/admin/pedidos` - Gestión de pedidos
- `/admin/clientes` - Gestión de clientes
- `/admin/inventario` - Gestión de productos y servicios
- `/admin/pagos` - Gestión de pagos
- `/admin/envios` - Gestión de envíos
- `/admin/soporte` - Panel de soporte técnico (solo rol soporte)

## Roles de Usuario

### Administrador
- Acceso completo a todas las funcionalidades administrativas
- Gestión de pedidos, clientes, inventario, pagos y envíos
- No tiene acceso al panel de soporte

### Asistente
- Acceso limitado a operaciones diarias
- Puede gestionar pedidos, clientes e inventario
- No puede acceder a pagos, envíos ni soporte

### Soporte Técnico
- Acceso exclusivo al panel de soporte
- Gestión de usuarios y contraseñas
- Auditoría de acciones del sistema
- No tiene acceso a operaciones de negocio

## Seguridad

### Middleware de Autenticación
- Todas las rutas `/admin/*` requieren autenticación
- Verificación de JWT en cada petición
- Control de acceso basado en roles
- Redirección automática si no hay permisos

### Auditoría
- Registro de logins y logouts
- Registro de acciones críticas (crear/editar/eliminar)
- Logs almacenados en base de datos
- Consulta de auditoría solo para rol soporte

## Base de Datos

### PostgreSQL (Neon)
- Todas las tablas según el diagrama ER proporcionado
- Migraciones en `/scripts`
- Conexión mediante `@neondatabase/serverless`

**Variables de entorno requeridas:**
- `DATABASE_URL` - URL de conexión a PostgreSQL
- `JWT_SECRET` - Secreto para firmar tokens JWT

## Despliegue Futuro

### Opción 1: Monorepo (Actual)
- Una sola aplicación Next.js
- Separación lógica mediante rutas
- Despliegue único en Vercel

### Opción 2: Aplicaciones Separadas (Recomendado para producción)
- **Catálogo**: Dominio público (ej: `www.elmundodelastutus.com`)
- **Admin**: Subdominio privado (ej: `admin.elmundodelastutus.com`)
- Mejor seguridad y rendimiento
- Escalabilidad independiente

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router)
- **Backend**: Next.js API Routes
- **Base de datos**: PostgreSQL (Neon)
- **Autenticación**: JWT + bcrypt
- **UI**: shadcn/ui + Tailwind CSS
- **Despliegue**: Vercel
