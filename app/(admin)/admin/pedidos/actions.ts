"use server"

import { revalidatePath } from "next/cache"
import { adminAction } from "@/server/auth/action"
import { eliminarEnvio, obtenerEnvio } from "@/server/services/envios"
import { eliminarPago, obtenerPago, registrarPago } from "@/server/services/pagos"
import {
  actualizarEstadoPedido,
  agregarItem,
  editarItem,
  eliminarItem,
  generarFactura,
} from "@/server/services/pedidos"
import { id } from "@/server/validators/common"
import { registrarPagoBody } from "@/server/validators/pagos"
import { actualizarEstadoBody, agregarItemBody, editarItemBody } from "@/server/validators/pedidos"

// Cada mutación del detalle refresca el detalle y el listado (total, estado).
function revalidarPedido(pedidoId: number) {
  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

const pedidoId = id("Pedido")
const itemId = id("Item")

export async function cambiarEstadoPedidoAction(rawPedidoId: number, input: unknown) {
  return adminAction({ permission: { module: "pedidos", action: "update" }, error: "Error al actualizar pedido" }, async () => {
    const id = pedidoId.parse(rawPedidoId)
    const { estado } = actualizarEstadoBody.parse(input)
    await actualizarEstadoPedido(id, estado)
    revalidarPedido(id)
  })
}

export async function agregarItemAction(rawPedidoId: number, input: unknown) {
  return adminAction({ permission: { module: "pedidos", action: "update" }, error: "Error al agregar item" }, async (user) => {
    const id = pedidoId.parse(rawPedidoId)
    await agregarItem(user, id, agregarItemBody.parse(input))
    revalidarPedido(id)
  })
}

export async function editarItemAction(rawPedidoId: number, rawItemId: number, input: unknown) {
  return adminAction({ permission: { module: "pedidos", action: "update" }, error: "Error al actualizar item" }, async (user) => {
    const id = pedidoId.parse(rawPedidoId)
    await editarItem(user, id, itemId.parse(rawItemId), editarItemBody.parse(input))
    revalidarPedido(id)
  })
}

export async function eliminarItemAction(rawPedidoId: number, rawItemId: number) {
  return adminAction({ permission: { module: "pedidos", action: "update" }, error: "Error al eliminar item" }, async (user) => {
    const id = pedidoId.parse(rawPedidoId)
    await eliminarItem(user, id, itemId.parse(rawItemId))
    revalidarPedido(id)
  })
}

export async function registrarPagoAction(input: unknown) {
  return adminAction({ permission: { module: "pagos", action: "create" }, error: "Error al registrar pago" }, async (user) => {
    const pago = await registrarPago(user, registrarPagoBody.parse(input))
    revalidarPedido(pago.pedido_id)
    revalidatePath("/admin/pagos")
    revalidatePath("/admin/envios")
  })
}

export async function eliminarPagoAction(rawPagoId: number) {
  return adminAction({ permission: { module: "pagos", action: "delete" }, error: "Error al eliminar pago" }, async () => {
    const pago = await obtenerPago(id("Pago").parse(rawPagoId))
    await eliminarPago(pago.id)
    revalidarPedido(pago.pedido_id)
    revalidatePath("/admin/pagos")
  })
}

export async function eliminarEnvioAction(rawEnvioId: number) {
  return adminAction({ permission: { module: "envios", action: "delete" }, error: "Error al eliminar envío" }, async () => {
    const envio = await obtenerEnvio(id("Envío").parse(rawEnvioId))
    await eliminarEnvio(envio.id)
    revalidarPedido(envio.pedido_id)
    revalidatePath("/admin/envios")
  })
}

export async function generarFacturaAction(rawPedidoId: number) {
  return adminAction({ permission: { module: "pedidos", action: "create" }, error: "Error al generar la factura" }, async (user) => {
    const id = pedidoId.parse(rawPedidoId)
    const factura = await generarFactura(user, id)
    revalidarPedido(id)
    return { id: factura.id, numero_factura: factura.numero_factura }
  })
}
