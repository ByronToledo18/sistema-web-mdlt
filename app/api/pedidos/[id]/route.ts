import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { generarNumeroGuia } from "@/lib/envios"

// GET - Obtener pedido con detalles
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params

    const pedidoResult = await sql`
      SELECT p.id, p.codigo, p.cliente_id, p.estado, p.fecha_creacion, p.total, p.notas,
             p.created_at, p.updated_at,
             c.nombre as cliente_nombre, c.telefono as cliente_telefono, 
             c.email as cliente_email, c.direccion as cliente_direccion
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ${id}
    `

    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    // Obtener items del pedido
    const itemsResult = await sql`SELECT * FROM pedido_items WHERE pedido_id = ${id} ORDER BY created_at`

    const pedido = {
      ...pedidoResult[0],
      items: itemsResult,
    }

    return NextResponse.json({ pedido })
  } catch (error: any) {
    console.error("[v0] Get pedido error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener pedido" }, { status: 500 })
  }
}

// PUT - Actualizar estado del pedido
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador", "asistente"])
    const { id } = await params
    const { estado } = await request.json()

    if (!estado) {
      return NextResponse.json({ error: "El estado es requerido" }, { status: 400 })
    }

    const validEstados = ["recibido", "en_proceso", "terminado", "anulado", "entregado"]
    if (!validEstados.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }

    if (estado === "terminado") {
      const pedidoData = await sql`
        SELECT total, ciudad_envio FROM pedidos WHERE id = ${id}
      `

      if (pedidoData.length === 0) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
      }

      const pagosData = await sql`
        SELECT COALESCE(SUM(monto), 0) as total_pagado
        FROM pagos
        WHERE pedido_id = ${id}
      `

      const totalPedido = Number.parseFloat(pedidoData[0].total)
      const totalPagado = Number.parseFloat(pagosData[0].total_pagado)
      const saldoPendiente = totalPedido - totalPagado

      if (saldoPendiente > 0) {
        return NextResponse.json(
          {
            error: `No se puede completar el pedido con saldo pendiente de $${saldoPendiente.toFixed(2)}`,
          },
          { status: 400 },
        )
      }

      if (pedidoData[0].ciudad_envio) {
        const shippingItems = await sql`
          SELECT pi.*, s.nombre
          FROM pedido_items pi
          JOIN servicios s ON pi.item_id = s.id
          WHERE pi.pedido_id = ${id} 
          AND pi.item_tipo = 'servicio'
          AND s.nombre = 'Envío'
        `

        if (shippingItems.length > 0) {
          const existingShipments = await sql`
            SELECT COUNT(*) as count
            FROM envios
            WHERE pedido_id = ${id}
          `

          if (Number.parseInt(existingShipments[0].count) === 0) {
            // La tabla envios usa la columna `guia`, no `codigo` (bug real:
            // esta inserción fallaba con "column codigo does not exist"
            // cada vez que se cerraba un pedido con envío sin haber creado
            // un envío explícito antes). Usa el mismo generador atómico que
            // el resto del sistema.
            const guia = await generarNumeroGuia()

            await sql`
              INSERT INTO envios (pedido_id, guia, fecha_envio, estado, costo)
              VALUES (
                ${id},
                ${guia},
                CURRENT_TIMESTAMP,
                'pendiente',
                ${shippingItems[0].precio_unitario}
              )
            `
          }
        }
      }
    }

    const result = await sql`
      UPDATE pedidos
      SET estado = ${estado}, updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil'
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({ pedido: result[0] })
  } catch (error: any) {
    console.error("[v0] Update pedido error:", error)
    return NextResponse.json({ error: error.message || "Error al actualizar pedido" }, { status: 500 })
  }
}

// DELETE - Eliminar pedido
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador"])
    const { id } = await params

    const result = await sql`DELETE FROM pedidos WHERE id = ${id} RETURNING *`

    if (result.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete pedido error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar pedido" }, { status: 500 })
  }
}
