import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { generarNumeroGuia } from "@/lib/envios"

// GET - Listar pagos con filtros
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] GET pagos - Start")
    await requireAuth(["administrador", "asistente"])
    console.log("[v0] GET pagos - Auth passed")

    const { searchParams } = new URL(request.url)
    const pedidoId = searchParams.get("pedido_id")
    console.log("[v0] GET pagos - pedidoId:", pedidoId)

    let pagos
    if (pedidoId) {
      pagos = await sql`
        SELECT p.*, ped.codigo as pedido_codigo, c.nombre as cliente_nombre
        FROM pagos p
        JOIN pedidos ped ON p.pedido_id = ped.id
        JOIN clientes c ON ped.cliente_id = c.id
        WHERE p.pedido_id = ${pedidoId}
        ORDER BY p.fecha DESC
      `
    } else {
      pagos = await sql`
        SELECT p.*, ped.codigo as pedido_codigo, c.nombre as cliente_nombre
        FROM pagos p
        JOIN pedidos ped ON p.pedido_id = ped.id
        JOIN clientes c ON ped.cliente_id = c.id
        ORDER BY p.fecha DESC
      `
    }

    console.log("[v0] GET pagos - Query result:", pagos.length)
    return NextResponse.json({ pagos })
  } catch (error: any) {
    console.error("[v0] Get pagos error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener pagos" }, { status: 500 })
  }
}

// POST - Registrar pago
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(["administrador", "asistente"])

    const { pedido_id, monto, metodo, referencia, observacion } = await request.json()

    if (!pedido_id || !monto) {
      return NextResponse.json({ error: "Pedido y monto son requeridos" }, { status: 400 })
    }

    if (monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
    }

    // Verificar que el pedido existe y obtener su estado
    const pedidoResult = await sql`SELECT id, total, estado FROM pedidos WHERE id = ${pedido_id}`

    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const pedidoEstado = pedidoResult[0].estado
    const isOrderClosed = pedidoEstado === "terminado" || pedidoEstado === "anulado"

    if (isOrderClosed && user.rol === "asistente") {
      return NextResponse.json(
        { error: "No se pueden registrar pagos en un pedido terminado o anulado" },
        { status: 403 },
      )
    }

    // Verificar que el monto no exceda el saldo pendiente
    const totalPagadoResult = await sql`
      SELECT COALESCE(SUM(monto), 0) as total FROM pagos WHERE pedido_id = ${pedido_id}
    `

    const totalPagado = Number.parseFloat(totalPagadoResult[0]?.total || "0")
    const totalPedido = Number.parseFloat(pedidoResult[0].total)
    const nuevoTotal = totalPagado + monto

    if (nuevoTotal > totalPedido) {
      return NextResponse.json(
        {
          error: `El monto excede el saldo pendiente. Saldo: $${(totalPedido - totalPagado).toFixed(2)}`,
        },
        { status: 400 },
      )
    }

    // Registrar el pago
    const result = await sql`
      INSERT INTO pagos (pedido_id, monto, metodo, referencia, observacion)
      VALUES (${pedido_id}, ${monto}, ${metodo || null}, ${referencia || null}, ${observacion || null})
      RETURNING *
    `

    const newTotalPagado = totalPagado + monto
    const saldoPendiente = totalPedido - newTotalPagado

    console.log(`[v0] Payment registered. New balance: ${saldoPendiente}`)

    if (saldoPendiente === 0) {
      console.log(`[v0] Balance is 0, checking for shipping items...`)

      // Check if there's a shipping item
      const shippingItems = await sql`
        SELECT pi.*, s.nombre
        FROM pedido_items pi
        JOIN servicios s ON pi.item_id = s.id
        WHERE pi.pedido_id = ${pedido_id} 
        AND pi.item_tipo = 'servicio'
        AND s.nombre = 'Envío'
      `

      console.log(`[v0] Found ${shippingItems.length} shipping items`)

      if (shippingItems.length > 0) {
        // Check if shipment already exists
        const existingShipments = await sql`
          SELECT COUNT(*) as count
          FROM envios
          WHERE pedido_id = ${pedido_id}
        `

        const shipmentCount = Number.parseInt(existingShipments[0].count)
        console.log(`[v0] Existing shipments for order ${pedido_id}: ${shipmentCount}`)

        if (shipmentCount === 0) {
          // Create shipment automatically
          const shippingItem = shippingItems[0]
          const shippingCost = Number.parseFloat(shippingItem.precio_unitario)
          const guia = await generarNumeroGuia()

          console.log(`[v0] Creating shipment with guia: ${guia}, cost: ${shippingCost}`)

          const shipmentResult = await sql`
            INSERT INTO envios (pedido_id, guia, costo, estado, fecha_envio)
            VALUES (
              ${pedido_id},
              ${guia},
              ${shippingCost},
              'pendiente',
              CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil'
            )
            RETURNING *
          `

          console.log(`[v0] Shipment created successfully:`, shipmentResult[0])
          console.log(`[v0] Auto-created shipment ${guia} for order ${pedido_id} after payment completion`)
        } else {
          console.log(`[v0] Shipment already exists for order ${pedido_id}, skipping creation`)
        }
      } else {
        console.log(`[v0] No shipping items found for order ${pedido_id}`)
      }
    }

    return NextResponse.json({ pago: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create pago error:", error)
    return NextResponse.json({ error: error.message || "Error al registrar pago" }, { status: 500 })
  }
}
