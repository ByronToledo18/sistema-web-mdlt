export type Role = "administrador" | "asistente" | "soporte"

export interface Permission {
  module: string
  actions: {
    create?: boolean
    read?: boolean
    update?: boolean
    delete?: boolean
  }
}

/**
 * Definición de permisos por rol
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  administrador: [
    {
      module: "clientes",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "pedidos",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "productos",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "servicios",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "pagos",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "envios",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "nomina",
      actions: { create: true, read: true, update: true, delete: true },
    },
    {
      module: "usuarios",
      actions: { create: true, read: true, update: true, delete: false },
    },
    {
      module: "auditoria",
      actions: { create: false, read: true, update: false, delete: false },
    },
  ],
  asistente: [
    {
      module: "clientes",
      actions: { create: true, read: true, update: true, delete: false },
    },
    {
      module: "pedidos",
      actions: { create: true, read: true, update: true, delete: false },
    },
    {
      module: "productos",
      actions: { create: false, read: true, update: false, delete: false },
    },
    {
      module: "servicios",
      actions: { create: false, read: true, update: false, delete: false },
    },
    {
      module: "pagos",
      actions: { create: true, read: true, update: false, delete: false },
    },
    {
      module: "envios",
      actions: { create: true, read: true, update: true, delete: false },
    },
  ],
  soporte: [
    {
      module: "usuarios",
      actions: { create: true, read: true, update: true, delete: false },
    },
    {
      module: "auditoria",
      actions: { create: false, read: true, update: false, delete: false },
    },
    {
      module: "sistema",
      actions: { create: true, read: true, update: true, delete: false },
    },
  ],
}

/**
 * Verifica si un rol tiene permiso para una acción en un módulo
 */
export function hasPermission(role: Role, module: string, action: "create" | "read" | "update" | "delete"): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  const modulePermission = permissions.find((p) => p.module === module)

  if (!modulePermission) return false

  return modulePermission.actions[action] === true
}

/**
 * Obtiene todos los módulos accesibles para un rol
 */
export function getAccessibleModules(role: Role): string[] {
  return ROLE_PERMISSIONS[role].map((p) => p.module)
}
