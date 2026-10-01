import { describe, expect, test } from "vitest"
import {
  type Action,
  canAccessRoute,
  hasPermission,
  type Module,
  ROLE_PERMISSIONS,
  type Role,
  ROUTE_MODULES,
} from "@/lib/permissions"

const ROLES: Role[] = ["administrador", "asistente", "soporte"]
const ACTIONS: Action[] = ["create", "read", "update", "delete"]

// Matriz esperada, escrita a mano a propósito: cambiar un permiso obliga a
// cambiar esta tabla también, y el diff del PR lo deja a la vista.
// C = create, R = read, U = update, D = delete; "" = sin acceso.
const ESPERADO: Record<Module, Record<Role, string>> = {
  clientes: { administrador: "CRUD", asistente: "CRU", soporte: "" },
  pedidos: { administrador: "CRUD", asistente: "CRU", soporte: "" },
  pedidos_cerrados: { administrador: "U", asistente: "", soporte: "" },
  productos: { administrador: "CRUD", asistente: "R", soporte: "" },
  servicios: { administrador: "CRUD", asistente: "R", soporte: "" },
  pagos: { administrador: "CRUD", asistente: "CR", soporte: "" },
  cobros: { administrador: "R", asistente: "", soporte: "" },
  envios: { administrador: "CRUD", asistente: "CRU", soporte: "" },
  servientrega: { administrador: "CRU", asistente: "R", soporte: "" },
  nomina: { administrador: "CRUD", asistente: "", soporte: "" },
  proveedores: { administrador: "CRUD", asistente: "", soporte: "" },
  usuarios: { administrador: "CRUD", asistente: "", soporte: "CRU" },
  auditoria: { administrador: "R", asistente: "", soporte: "R" },
  sistema: { administrador: "", asistente: "", soporte: "CRU" },
}

const LETRA: Record<Action, string> = { create: "C", read: "R", update: "U", delete: "D" }
const MODULES = Object.keys(ESPERADO) as Module[]

describe("matriz de permisos (rol × módulo × acción)", () => {
  const casos = ROLES.flatMap((rol) =>
    MODULES.flatMap((module) =>
      ACTIONS.map((action) => ({ rol, module, action, permitido: ESPERADO[module][rol].includes(LETRA[action]) })),
    ),
  )

  test.each(casos)("$rol · $module · $action → $permitido", ({ rol, module, action, permitido }) => {
    expect(hasPermission(rol, module, action)).toBe(permitido)
  })

  test("ROLE_PERMISSIONS no tiene módulos fuera de la matriz", () => {
    for (const rol of ROLES) {
      for (const module of Object.keys(ROLE_PERMISSIONS[rol])) {
        expect(MODULES).toContain(module)
      }
    }
  })

  test("un rol desconocido no tiene ningún permiso", () => {
    for (const module of MODULES) {
      for (const action of ACTIONS) {
        expect(hasPermission("cliente", module, action)).toBe(false)
        expect(hasPermission("", module, action)).toBe(false)
        expect(hasPermission("toString", module, action)).toBe(false)
      }
    }
  })
})

describe("canAccessRoute (middleware y sidebar)", () => {
  test.each([
    ["administrador", "/admin/dashboard", true],
    ["administrador", "/admin/nomina", true],
    ["administrador", "/admin/pagos", true],
    ["administrador", "/admin/soporte", false],
    ["asistente", "/admin/pedidos", true],
    ["asistente", "/admin/pedidos/15", true],
    ["asistente", "/admin/inventario", true],
    ["asistente", "/admin/pagos", false],
    ["asistente", "/admin/nomina", false],
    ["asistente", "/admin/proveedores/3/facturas", false],
    ["soporte", "/admin/dashboard", true],
    ["soporte", "/admin/soporte", true],
    ["soporte", "/admin/pedidos", false],
    ["cliente", "/admin/dashboard", false],
  ] as const)("%s → %s: %s", (rol, ruta, esperado) => {
    expect(canAccessRoute(rol, ruta)).toBe(esperado)
  })

  test("una ruta /admin que no está en ROUTE_MODULES no es accesible", () => {
    expect(canAccessRoute("administrador", "/admin/secreta")).toBe(false)
    // Prefijo parecido pero distinto segmento.
    expect(canAccessRoute("administrador", "/admin/pedidosx")).toBe(false)
  })

  test("cada página exige leer un módulo existente", () => {
    for (const module of Object.values(ROUTE_MODULES)) {
      if (module !== null) expect(MODULES).toContain(module)
    }
  })
})
