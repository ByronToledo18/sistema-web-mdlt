import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener factura con detalles
export async function GET(request: NextRequest, { params }: { params: Promise<{ facturaId: string }> }) {
  try {
    await requireAuth(["administrador"])

    const { facturaId } = await params

    const facturaResult = await sql`
      SELECT 
        f.*,
        p.nombre as proveedor_nombre,
        p.ruc as proveedor_ruc
      FROM proveedor_facturas f
      JOIN proveedores p ON f.proveedor_id = p.id
      WHERE f.id = ${facturaId}
    `

    if (facturaResult.length === 0) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    }

    const factura = facturaResult[0]

    // Get items
    const items = await sql`
      SELECT 
        fi.*,
        pr.nombre as producto_nombre,
        pr.sku as producto_sku
      FROM proveedor_factura_items fi
      LEFT JOIN productos pr ON fi.producto_id = pr.id
      WHERE fi.factura_id = ${facturaId}
      ORDER BY fi.id
    `

    // Get pagos
    const pagos = await sql`
      SELECT * FROM proveedor_pagos
      WHERE factura_id = ${facturaId}
      ORDER BY fecha DESC
    `

    return NextResponse.json({ factura, items, pagos })
  } catch (error: any) {
    console.error("[v0] Get factura error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener factura" }, { status: 500 })
  }
}

// DELETE - Anular factura
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ facturaId: string }> }) {
  try {
    await requireAuth(["administrador"])

    const { facturaId } = await params

    // Check if factura has payments
    const pagos = await sql`SELECT COUNT(*) as count FROM proveedor_pagos WHERE factura_id = ${facturaId}`

    if (Number(pagos[0].count) > 0) {
      return NextResponse.json({ error: "No se puede anular una factura con pagos registrados" }, { status: 400 })
    }

    // Get items to revert stock
    const items = await sql`
      SELECT producto_id, cantidad 
      FROM proveedor_factura_items 
      WHERE factura_id = ${facturaId} AND producto_id IS NOT NULL
    `

    // Revert stock
    for (const item of items) {
      const cantidad = Math.floor(Number.parseFloat(item.cantidad))
      await sql`
        UPDATE productos
        SET stock = stock - ${cantidad}
        WHERE id = ${item.producto_id}
      `
    }

    // Update factura status
    const result = await sql`
      UPDATE proveedor_facturas
      SET estado = 'anulada', saldo = 0
      WHERE id = ${facturaId}
      RETURNING *
    `

    return NextResponse.json({ factura: result[0] })
  } catch (error: any) {
    console.error("[v0] Delete factura error:", error)
    return NextResponse.json({ error: error.message || "Error al anular factura" }, { status: 500 })
  }
}
