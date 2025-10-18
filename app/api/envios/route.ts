import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { generarNumeroGuia } from "@/lib/envios"
import { actualizarTotalPedido } from "@/lib/pedidos"

// GET - Listar envíos
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] GET envios - Start")
    await requireAuth(["administrador", "asistente"])
    console.log("[v0] GET envios - Auth passed")

    const { searchParams } = new URL(request.url)
    const pedidoId = searchParams.get("pedido_id")
    console.log("[v0] GET envios - pedidoId:", pedidoId)

    let envios
    if (pedidoId) {
      envios = await sql`
        SELECT e.*, p.codigo as pedido_codigo, c.nombre as cliente_nombre
        FROM envios e
        JOIN pedidos p ON e.pedido_id = p.id
        JOIN clientes c ON p.cliente_id = c.id
        WHERE e.pedido_id = ${pedidoId}
        ORDER BY e.created_at DESC
      `
    } else {
      envios = await sql`
        SELECT e.*, p.codigo as pedido_codigo, c.nombre as cliente_nombre
        FROM envios e
        JOIN pedidos p ON e.pedido_id = p.id
        JOIN clientes c ON p.cliente_id = c.id
        ORDER BY e.created_at DESC
      `
    }

    console.log("[v0] GET envios - Query result:", envios.length)
    return NextResponse.json({ envios })
  } catch (error: any) {
    console.error("[v0] Get envios error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener envíos" }, { status: 500 })
  }
}

// POST - Crear envío
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(["administrador", "asistente"])

    const { pedido_id, costo } = await request.json()

    if (!pedido_id) {
      return NextResponse.json({ error: "El pedido es requerido" }, { status: 400 })
    }

    if (!costo || costo <= 0) {
      return NextResponse.json({ error: "El costo de envío es requerido y debe ser mayor a 0" }, { status: 400 })
    }

    // Verificar pedido
    const pedidoResult = await sql`
      SELECT p.id, p.total, p.estado
      FROM pedidos p
      WHERE p.id = ${pedido_id}
    `

    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const pedido = pedidoResult[0]
    const isOrderClosed = pedido.estado === "terminado" || pedido.estado === "anulado"

    if (isOrderClosed && user.rol === "asistente") {
      return NextResponse.json(
        { error: "No se pueden crear envíos para un pedido terminado o anulado" },
        { status: 403 },
      )
    }

    await sql`
      INSERT INTO pedido_items (pedido_id, item_tipo, item_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (${pedido_id}, 'envio', NULL, 'Costo de Envío', 1, ${costo}, ${costo})
    `

    // Update order total
    await actualizarTotalPedido(Number.parseInt(pedido_id))

    // Generar número de guía y crear envío con estado inicial 'pendiente'
    const guia = await generarNumeroGuia()

    const result = await sql`
      INSERT INTO envios (pedido_id, guia, fecha_envio, estado, costo)
      VALUES (${pedido_id}, ${guia}, CURRENT_TIMESTAMP, 'pendiente', ${costo})
      RETURNING *
    `

    return NextResponse.json({ envio: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create envio error:", error)
    return NextResponse.json({ error: error.message || "Error al crear envío" }, { status: 500 })
  }
}
