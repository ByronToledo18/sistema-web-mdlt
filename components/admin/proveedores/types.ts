import type { listarProveedores } from "@/server/services/proveedores"

export type Proveedor = Awaited<ReturnType<typeof listarProveedores>>[number]
