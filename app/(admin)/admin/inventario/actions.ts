"use server"

import { revalidatePath } from "next/cache"
import { adminAction } from "@/server/auth/action"
import {
  actualizarProducto,
  actualizarServicio,
  alternarEstadoProducto,
  alternarEstadoServicio,
  crearProducto,
  crearServicio,
  eliminarProducto,
  eliminarServicio,
} from "@/server/services/catalogo"
import { productoBody, servicioBody } from "@/server/validators/catalogo"
import { id } from "@/server/validators/common"

// Productos y servicios se ven en el inventario y en el catálogo público.
function revalidarInventario() {
  revalidatePath("/admin/inventario")
  revalidatePath("/catalogo")
}

const productoId = id("Producto")
const servicioId = id("Servicio")

// --- Productos ---------------------------------------------------------------------

export async function guardarProductoAction(rawId: number | null, input: unknown) {
  const action = rawId === null ? "create" : "update"
  return adminAction({ permission: { module: "productos", action }, error: "Error al guardar producto" }, async () => {
    const datos = productoBody.parse(input)
    if (rawId === null) await crearProducto(datos)
    else await actualizarProducto(productoId.parse(rawId), datos)
    revalidarInventario()
  })
}

export async function alternarEstadoProductoAction(rawId: number) {
  return adminAction(
    { permission: { module: "productos", action: "update" }, error: "Error al cambiar estado del producto" },
    async () => {
      await alternarEstadoProducto(productoId.parse(rawId))
      revalidarInventario()
    },
  )
}

export async function eliminarProductoAction(rawId: number) {
  return adminAction({ permission: { module: "productos", action: "delete" }, error: "Error al eliminar producto" }, async () => {
    await eliminarProducto(productoId.parse(rawId))
    revalidarInventario()
  })
}

// --- Servicios ---------------------------------------------------------------------

export async function guardarServicioAction(rawId: number | null, input: unknown) {
  const action = rawId === null ? "create" : "update"
  return adminAction({ permission: { module: "servicios", action }, error: "Error al guardar servicio" }, async () => {
    const datos = servicioBody.parse(input)
    if (rawId === null) await crearServicio(datos)
    else await actualizarServicio(servicioId.parse(rawId), datos)
    revalidarInventario()
  })
}

export async function alternarEstadoServicioAction(rawId: number) {
  return adminAction(
    { permission: { module: "servicios", action: "update" }, error: "Error al cambiar estado del servicio" },
    async () => {
      await alternarEstadoServicio(servicioId.parse(rawId))
      revalidarInventario()
    },
  )
}

export async function eliminarServicioAction(rawId: number) {
  return adminAction({ permission: { module: "servicios", action: "delete" }, error: "Error al eliminar servicio" }, async () => {
    await eliminarServicio(servicioId.parse(rawId))
    revalidarInventario()
  })
}
