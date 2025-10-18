import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { actualizarTotalPedido } from "@/lib/pedidos"

// PUT - Actualizar item
export async function PUT(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const user = await requireAuth(["administrador", "asistente"])
    const { id: pedidoId, itemId } = params
    const { cantidad, precio_unitario, descripcion } = await request.json()

    const pedidoResult = await sql`SELECT estado FROM pedidos WHERE id = ${pedidoId}`
    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const pedidoEstado = pedidoResult[0].estado
    const isOrderClosed = pedidoEstado === "terminado" || pedidoEstado === "anulado"

    if (isOrderClosed && user.rol === "asistente") {
      return NextResponse.json(
        { error: "No se pueden modificar items de un pedido terminado o anulado" },
        { status: 403 },
      )
    }

    if (cantidad !== undefined && cantidad <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 })
    }

    if (precio_unitario !== undefined && precio_unitario < 0) {
      return NextResponse.json({ error: "El precio no puede ser negativo" }, { status: 400 })
    }

    // Obtener item actual
    const currentItem = await sql`SELECT * FROM pedido_items WHERE id = ${itemId} AND pedido_id = ${pedidoId}`

    if (currentItem.length === 0) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })
    }

    const newCantidad = cantidad !== undefined ? cantidad : currentItem[0].cantidad
    const newPrecio = precio_unitario !== undefined ? precio_unitario : currentItem[0].precio_unitario
    const newDescripcion = descripcion !== undefined ? descripcion : currentItem[0].descripcion
    const subtotal = newCantidad * newPrecio

    const result = await sql`
      UPDATE pedido_items
      SET cantidad = ${newCantidad}, precio_unitario = ${newPrecio}, descripcion = ${newDescripcion}, subtotal = ${subtotal}
      WHERE id = ${itemId} AND pedido_id = ${pedidoId}
      RETURNING *
    `

    // Actualizar total del pedido
    await actualizarTotalPedido(Number.parseInt(pedidoId))

    return NextResponse.json({ item: result[0] })
  } catch (error: any) {
    console.error("[v0] Update item error:", error)
    return NextResponse.json({ error: error.message || "Error al actualizar item" }, { status: 500 })
  }
}

// DELETE - Eliminar item
export async function DELETE(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const user = await requireAuth(["administrador", "asistente"])
    const { id: pedidoId, itemId } = params

    const pedidoResult = await sql`SELECT estado FROM pedidos WHERE id = ${pedidoId}`
    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const pedidoEstado = pedidoResult[0].estado
    const isOrderClosed = pedidoEstado === "terminado" || pedidoEstado === "anulado"

    if (isOrderClosed && user.rol === "asistente") {
      return NextResponse.json(
        { error: "No se pueden eliminar items de un pedido terminado o anulado" },
        { status: 403 },
      )
    }

    const itemResult = await sql`
      SELECT item_tipo, item_id, cantidad 
      FROM pedido_items 
      WHERE id = ${itemId} AND pedido_id = ${pedidoId}
    `

    if (itemResult.length === 0) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })
    }

    const item = itemResult[0]

    if (item.item_tipo === "producto" && item.item_id) {
      const cantidadInt = Math.floor(Number.parseFloat(item.cantidad))
      await sql`
        UPDATE productos
        SET stock = stock + ${cantidadInt}
        WHERE id = ${item.item_id}
      `

      console.log(`[v0] Restored ${cantidadInt} units to product ${item.item_id}`)
    }

    const result = await sql`DELETE FROM pedido_items WHERE id = ${itemId} AND pedido_id = ${pedidoId} RETURNING *`

    // Actualizar total del pedido
    await actualizarTotalPedido(Number.parseInt(pedidoId))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete item error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar item" }, { status: 500 })
  }
}
