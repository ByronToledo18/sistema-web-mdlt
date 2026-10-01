"use server"

import { revalidatePath } from "next/cache"
import { adminAction } from "@/server/auth/action"
import {
  actualizarProveedor,
  alternarEstadoProveedor,
  anularFacturaProveedor,
  crearFacturaProveedor,
  crearProveedor,
  pagarFacturaProveedor,
} from "@/server/services/proveedores"
import { id } from "@/server/validators/common"
import { crearFacturaBody, pagoFacturaBody, proveedorBody } from "@/server/validators/proveedores"

const proveedorId = id("Proveedor")
const facturaId = id("Factura")

// Las compras cambian el stock: también se refrescan inventario y catálogo.
function revalidarFacturas(provId: number) {
  revalidatePath(`/admin/proveedores/${provId}/facturas`)
  revalidatePath("/admin/proveedores")
  revalidatePath("/admin/inventario")
  revalidatePath("/catalogo")
}

// --- Proveedores --------------------------------------------------------------------

export async function guardarProveedorAction(rawId: number | null, input: unknown) {
  const action = rawId === null ? "create" : "update"
  return adminAction({ permission: { module: "proveedores", action }, error: "Error al guardar proveedor" }, async () => {
    const datos = proveedorBody.parse(input)
    if (rawId === null) await crearProveedor(datos)
    else await actualizarProveedor(proveedorId.parse(rawId), datos)
    revalidatePath("/admin/proveedores")
  })
}

export async function alternarEstadoProveedorAction(rawId: number) {
  return adminAction(
    { permission: { module: "proveedores", action: "update" }, error: "Error al cambiar estado del proveedor" },
    async () => {
      await alternarEstadoProveedor(proveedorId.parse(rawId))
      revalidatePath("/admin/proveedores")
    },
  )
}

// --- Facturas de compra -------------------------------------------------------------

export async function crearFacturaProveedorAction(rawProveedorId: number, input: unknown) {
  return adminAction({ permission: { module: "proveedores", action: "create" }, error: "Error al crear factura" }, async () => {
    const provId = proveedorId.parse(rawProveedorId)
    await crearFacturaProveedor(provId, crearFacturaBody.parse(input))
    revalidarFacturas(provId)
  })
}

export async function pagarFacturaProveedorAction(rawFacturaId: number, input: unknown) {
  return adminAction({ permission: { module: "proveedores", action: "update" }, error: "Error al registrar pago" }, async () => {
    const factura = await pagarFacturaProveedor(facturaId.parse(rawFacturaId), pagoFacturaBody.parse(input))
    revalidarFacturas(factura.proveedor_id)
  })
}

export async function anularFacturaProveedorAction(rawFacturaId: number) {
  return adminAction({ permission: { module: "proveedores", action: "delete" }, error: "Error al anular factura" }, async () => {
    const factura = await anularFacturaProveedor(facturaId.parse(rawFacturaId))
    revalidarFacturas(factura.proveedor_id)
  })
}

