import type { listarProductos, listarServicios } from "@/server/services/catalogo"

export type Producto = Awaited<ReturnType<typeof listarProductos>>[number]
export type Servicio = Awaited<ReturnType<typeof listarServicios>>[number]
