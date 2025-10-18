# Sistema Web - El Mundo de las Tutus

Sistema de gestión integral para el emprendimiento "El Mundo de las Tutus", especializado en confección y comercialización de tutús y prendas personalizadas.

## 🚀 Características

- **Gestión de Pedidos**: Sistema de seguimiento con ID único (TUTU-YYYY-####)
- **Control de Inventario**: Productos y servicios con precios variables
- **Pagos Recibidos**: Registro de abonos y consolidación mensual
- **Nómina**: Gestión de pagos a costureras
- **Envíos**: Integración con Servientrega
- **Autenticación**: Sistema JWT con 3 roles (Administrador, Asistente, Soporte)

## 📋 Requisitos Previos

- Node.js 18+
- PostgreSQL (Neon)
- Cuenta de Vercel (para deployment)

## 🛠️ Instalación

1. Clonar el repositorio:
\`\`\`bash
git clone https://github.com/ByronToledo18/sistema-web-mdlt.git
cd sistema-web-mdlt
\`\`\`

2. Instalar dependencias:
\`\`\`bash
npm install
\`\`\`

3. Configurar variables de entorno:
\`\`\`bash
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_secret_key_here
\`\`\`

4. Ejecutar migraciones de base de datos:
- Ir a la sección "Scripts" en v0
- Ejecutar `001-create-tables.sql`
- Ejecutar `002-seed-data.sql`

5. Iniciar el servidor de desarrollo:
\`\`\`bash
npm run dev
\`\`\`

## 👤 Credenciales por Defecto

- **Email**: admin@elmundodelastutus.com
- **Contraseña**: Admin123!

⚠️ **IMPORTANTE**: Cambiar estas credenciales en producción.

## 📁 Estructura del Proyecto

\`\`\`
├── app/
│   ├── api/
│   │   └── auth/          # Endpoints de autenticación
│   ├── dashboard/         # Panel principal
│   ├── login/             # Página de login
│   └── page.tsx           # Página de inicio
├── lib/
│   ├── db.ts              # Conexión a base de datos
│   └── auth.ts            # Utilidades de autenticación
├── scripts/
│   ├── 001-create-tables.sql
│   └── 002-seed-data.sql
└── middleware.ts          # Protección de rutas
\`\`\`

## 🗓️ Plan de Desarrollo (8 Semanas)

- ✅ **Semana 1**: Setup base, DB, Auth JWT
- ⏳ **Semana 2**: Módulo Clientes + Pedidos
- ⏳ **Semana 3**: Productos/Servicios + Items
- ⏳ **Semana 4**: Pagos + Consolidación
- ⏳ **Semana 5**: Envíos + Servientrega
- ⏳ **Semana 6**: Roles y Soporte Técnico
- ⏳ **Semana 7**: Catálogo Web + WhatsApp
- ⏳ **Semana 8**: Estabilización + Demo

## 🔐 Roles de Usuario

1. **Administrador**: Acceso completo al sistema
2. **Asistente**: Gestión operativa de pedidos
3. **Soporte Técnico**: Mantenimiento y auditoría

## 📊 Base de Datos

El sistema utiliza PostgreSQL con las siguientes tablas principales:
- roles, usuarios, clientes
- productos, servicios, pedidos, pedido_items
- pagos, envios, servientrega_cuenta, servientrega_detalle
- nomina_mov

## 🤝 Contribución

Este es un proyecto privado para "El Mundo de las Tutus".

## 📄 Licencia

Propietario: El Mundo de las Tutus
\`\`\`
