import { type NextRequest, NextResponse } from "next/server"
import { sql, executeQuery } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"

const IVA_RATE = 0.15 // mismo porcentaje que ya usa proveedor_facturas

// GET - Obtener la factura de un pedido (si existe)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["administrador", "asistente"])

    const { id } = await params
    const result = await sql`
      SELECT f.*, p.codigo as pedido_codigo, c.nombre as cliente_nombre, c.cedula as cliente_cedula
      FROM pedido_facturas f
      JOIN pedidos p ON f.pedido_id = p.id
      JOIN clientes c ON p.cliente_id = c.id
      WHERE f.pedido_id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json({ factura: null })
    }

    return NextResponse.json({ factura: result[0] })
  } catch (error: any) {
    console.error("[v0] Get factura error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener factura" }, { status: 500 })
  }
}

// POST - Generar la factura de un pedido a partir de sus pedido_items
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador", "asistente"])

    const { id } = await params

    const existing = await sql`SELECT id FROM pedido_facturas WHERE pedido_id = ${id}`
    if (existing.length > 0) {
      return NextResponse.json({ error: "Este pedido ya tiene una factura generada" }, { status: 400 })
    }

    const pedidoResult = await sql`SELECT id, codigo, estado FROM pedidos WHERE id = ${id}`
    if (pedidoResult.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    if (pedidoResult[0].estado === "anulado") {
      return NextResponse.json({ error: "No se puede facturar un pedido anulado" }, { status: 400 })
    }

    const items = await sql`SELECT subtotal FROM pedido_items WHERE pedido_id = ${id}`
    if (items.length === 0) {
      return NextResponse.json({ error: "El pedido no tiene ítems para facturar" }, { status: 400 })
    }

    const subtotal = items.reduce((sum, item) => sum + Number.parseFloat(item.subtotal), 0)
    const iva = subtotal * IVA_RATE
    const total = subtotal + iva

    // Numeración correlativa por año vía secuencia de Postgres (nextval es
    // atómico) - mismo patrón que generatePedidoCodigo()/generarNumeroGuia()
    // en lib/pedidos.ts y lib/envios.ts, para no reintroducir la condición de
    // carrera que se corrigió ahí.
    const year = new Date().getFullYear()
    const prefix = `FACT-${year}-`
    const seqName = `factura_numero_seq_${year}`

    const exists = await executeQuery(`SELECT to_regclass($1) as reg`, [seqName])
    if (!exists[0]?.reg) {
      await executeQuery(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`, [])
    }
    const seqResult = await executeQuery(`SELECT nextval($1::regclass) as siguiente`, [seqName])
    const nextNumber = Number(seqResult[0].siguiente)
    const numeroFactura = `${prefix}${nextNumber.toString().padStart(4, "0")}`

    const factura = await sql`
      INSERT INTO pedido_facturas (pedido_id, numero_factura, subtotal, iva, total)
      VALUES (${id}, ${numeroFactura}, ${subtotal}, ${iva}, ${total})
      RETURNING *
    `

    await createAuditLog({
      usuario_id: user.id,
      accion: "crear",
      modulo: "pedidos",
      descripcion: `Generó factura ${numeroFactura} para el pedido ${pedidoResult[0].codigo}`,
    })

    return NextResponse.json({ factura: factura[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create factura error:", error)
    return NextResponse.json({ error: error.message || "Error al generar factura" }, { status: 500 })
  }
}
