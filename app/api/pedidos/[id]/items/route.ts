import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { actualizarTotalPedido } from "@/lib/pedidos"

// POST - Agregar item al pedido
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador", "asistente"])

    const { id: pedidoId } = await params

    const body = await request.json()

    const { item_tipo, item_id, descripcion, cantidad, precio_unitario } = body

    // Check if order exists and get its status
    const pedidoResult = await sql`SELECT estado FROM pedidos WHERE id = ${pedidoId}`

    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const pedidoEstado = pedidoResult[0].estado

    const isOrderClosed = pedidoEstado === "terminado" || pedidoEstado === "anulado"

    if (isOrderClosed && user.rol === "asistente") {
      return NextResponse.json({ error: "No se pueden agregar items a un pedido terminado o anulado" }, { status: 403 })
    }

    // Validaciones
    if (!item_tipo || !cantidad || precio_unitario === undefined) {
      return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 })
    }

    if (!["producto", "servicio", "envio"].includes(item_tipo)) {
      return NextResponse.json({ error: "Tipo de item inválido" }, { status: 400 })
    }

    if (item_tipo !== "envio" && !item_id) {
      return NextResponse.json({ error: "El ID del item es requerido" }, { status: 400 })
    }

    const cantidadInt = Math.floor(Number(cantidad))
    if (cantidadInt <= 0 || !Number.isInteger(Number(cantidad))) {
      return NextResponse.json({ error: "La cantidad debe ser un número entero mayor a 0" }, { status: 400 })
    }

    if (precio_unitario < 0) {
      return NextResponse.json({ error: "El precio no puede ser negativo" }, { status: 400 })
    }

    if (item_tipo === "producto") {
      const productoResult = await sql`
        SELECT stock FROM productos WHERE id = ${item_id}
      `

      if (productoResult.length === 0) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
      }

      const stockDisponible = Number.parseInt(productoResult[0].stock)

      if (stockDisponible < cantidadInt) {
        return NextResponse.json(
          { error: `Stock insuficiente. Disponible: ${stockDisponible} unidades` },
          { status: 400 },
        )
      }

      await sql`
        UPDATE productos
        SET stock = stock - ${cantidadInt}
        WHERE id = ${item_id}
      `

      console.log(`[v0] Deducted ${cantidadInt} units from product ${item_id}`)
    }

    const subtotal = cantidadInt * precio_unitario

    // Insertar item
    const result = await sql`
      INSERT INTO pedido_items (pedido_id, item_tipo, item_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (${pedidoId}, ${item_tipo}, ${item_id || null}, ${descripcion || null}, ${cantidadInt}, ${precio_unitario}, ${subtotal})
      RETURNING *
    `

    // Actualizar total del pedido
    await actualizarTotalPedido(Number.parseInt(pedidoId))

    return NextResponse.json({ item: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] POST item error:", error)
    return NextResponse.json({ error: error.message || "Error al agregar item" }, { status: 500 })
  }
}
