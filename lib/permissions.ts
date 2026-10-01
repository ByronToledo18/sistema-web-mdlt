// Fuente única de permisos del panel admin.
//
// La usan:
// - middleware.ts y components/dashboard/sidebar.tsx (qué páginas ve cada rol,
//   vía ROUTE_MODULES/canAccessRoute).
// - server/auth/guard.ts (withAuth/assertCan en cada route handler).
//
// Este archivo no importa nada de servidor: también corre en el middleware
// (edge) y en el cliente.

export type Role = "administrador" | "asistente" | "soporte"
export type Action = "create" | "read" | "update" | "delete"

export type Module =
  | "clientes"
  | "pedidos"
  // Modificar ítems, cobros y envíos de un pedido terminado o anulado.
  | "pedidos_cerrados"
  | "productos"
  | "servicios"
  // Registro de cobros de un pedido (lo usa el detalle del pedido).
  | "pagos"
  // Página de Cobros: listado global, consolidación mensual y reportes.
  | "cobros"
  | "envios"
  // Cuenta mensual con Servientrega (cargos y pagos).
  | "servientrega"
  | "nomina"
  | "proveedores"
  | "usuarios"
  | "auditoria"
  // Tickets de soporte.
  | "sistema"

const CRUD: Action[] = ["create", "read", "update", "delete"]
const CRU: Action[] = ["create", "read", "update"]
const CR: Action[] = ["create", "read"]
const R: Action[] = ["read"]

export const ROLE_PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  administrador: {
    clientes: CRUD,
    pedidos: CRUD,
    pedidos_cerrados: ["update"],
    productos: CRUD,
    servicios: CRUD,
    pagos: CRUD,
    cobros: R,
    envios: CRUD,
    servientrega: CRU,
    nomina: CRUD,
    proveedores: CRUD,
    usuarios: CRUD,
    auditoria: R,
  },
  asistente: {
    clientes: CRU,
    pedidos: CRU,
    productos: R,
    servicios: R,
    pagos: CR,
    envios: CRU,
    servientrega: R,
  },
  soporte: {
    usuarios: CRU,
    auditoria: R,
    sistema: CRU,
  },
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLE_PERMISSIONS
}

export function hasPermission(role: string, module: Module, action: Action): boolean {
  if (!isRole(role)) return false
  return ROLE_PERMISSIONS[role][module]?.includes(action) ?? false
}

// Página del admin → módulo que hay que poder leer para entrar.
// null = cualquier usuario autenticado. Una ruta /admin que no esté aquí no es
// accesible para nadie (el middleware redirige al dashboard).
export const ROUTE_MODULES: Record<string, Module | null> = {
  "/admin/dashboard": null,
  "/admin/pedidos": "pedidos",
  "/admin/clientes": "clientes",
  "/admin/inventario": "productos",
  "/admin/pagos": "cobros",
  "/admin/envios": "envios",
  "/admin/proveedores": "proveedores",
  "/admin/nomina": "nomina",
  "/admin/soporte": "sistema",
}

export function canAccessRoute(role: string, pathname: string): boolean {
  const route = Object.keys(ROUTE_MODULES).find((r) => pathname === r || pathname.startsWith(`${r}/`))
  if (!route) return false
  const modulo = ROUTE_MODULES[route]
  return modulo === null ? isRole(role) : hasPermission(role, modulo, "read")
}
