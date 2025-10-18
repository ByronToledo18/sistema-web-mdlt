import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Listar facturas de un proveedor
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador"])

    const { id } = params
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get("estado")

    let facturas

    if (estado && estado !== "todas") {
      facturas = await sql`
        SELECT 
          f.*,
          p.nombre as proveedor_nombre,
          COALESCE(SUM(pg.monto), 0) as total_pagado_real
        FROM proveedor_facturas f
        JOIN proveedores p ON f.proveedor_id = p.id
        LEFT JOIN proveedor_pagos pg ON f.id = pg.factura_id
        WHERE f.proveedor_id = ${id} AND f.estado = ${estado}
        GROUP BY f.id, p.nombre
        ORDER BY f.fecha_emision DESC
      `
    } else {
      facturas = await sql`
        SELECT 
          f.*,
          p.nombre as proveedor_nombre,
          COALESCE(SUM(pg.monto), 0) as total_pagado_real
        FROM proveedor_facturas f
        JOIN proveedores p ON f.proveedor_id = p.id
        LEFT JOIN proveedor_pagos pg ON f.id = pg.factura_id
        WHERE f.proveedor_id = ${id}
        GROUP BY f.id, p.nombre
        ORDER BY f.fecha_emision DESC
      `
    }

    return NextResponse.json({ facturas })
  } catch (error: any) {
    console.error("[v0] Get facturas error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener facturas" }, { status: 500 })
  }
}

// POST - Crear factura
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador"])

    const { id: proveedor_id } = params
    const { numero_factura, fecha_emision, fecha_vencimiento, items, notas } = await request.json()

    if (!numero_factura || !fecha_emision || !items || items.length === 0) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    // Check if factura number already exists for this proveedor
    const existing = await sql`
      SELECT id FROM proveedor_facturas 
      WHERE proveedor_id = ${proveedor_id} AND numero_factura = ${numero_factura}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "El número de factura ya existe para este proveedor" }, { status: 400 })
    }

    // Calculate totals
    let subtotal = 0
    for (const item of items) {
      subtotal += Number.parseFloat(item.cantidad) * Number.parseFloat(item.precio_unitario)
    }

    const iva = subtotal * 0.15 // 15% IVA
    const total = subtotal + iva
    const saldo = total

    // Create factura
    const facturaResult = await sql`
      INSERT INTO proveedor_facturas (
        proveedor_id, numero_factura, fecha_emision, fecha_vencimiento,
        subtotal, iva, total, pagado, saldo, notas
      )
      VALUES (
        ${proveedor_id}, ${numero_factura}, ${fecha_emision}, ${fecha_vencimiento || null},
        ${subtotal}, ${iva}, ${total}, 0, ${saldo}, ${notas || null}
      )
      RETURNING *
    `

    const factura = facturaResult[0]

    // Create factura items and update stock
    for (const item of items) {
      const itemSubtotal = Number.parseFloat(item.cantidad) * Number.parseFloat(item.precio_unitario)

      await sql`
        INSERT INTO proveedor_factura_items (
          factura_id, producto_id, descripcion, cantidad, precio_unitario, subtotal
        )
        VALUES (
          ${factura.id}, ${item.producto_id || null}, ${item.descripcion},
          ${item.cantidad}, ${item.precio_unitario}, ${itemSubtotal}
        )
      `

      // Update product stock if producto_id is provided
      if (item.producto_id) {
        await sql`
          UPDATE productos
          SET stock = stock + ${Number.parseFloat(item.cantidad)}
          WHERE id = ${item.producto_id}
        `
      }
    }

    return NextResponse.json({ factura }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create factura error:", error)
    return NextResponse.json({ error: error.message || "Error al crear factura" }, { status: 500 })
  }
}
