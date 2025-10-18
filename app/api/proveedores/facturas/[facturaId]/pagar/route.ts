import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// POST - Registrar pago a factura
export async function POST(request: NextRequest, { params }: { params: { facturaId: string } }) {
  try {
    await requireAuth(["administrador"])

    const { facturaId } = params
    const { monto, metodo, referencia, observacion } = await request.json()

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
    }

    // Get factura
    const facturaResult = await sql`
      SELECT total, pagado, saldo, estado FROM proveedor_facturas WHERE id = ${facturaId}
    `

    if (facturaResult.length === 0) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    }

    const factura = facturaResult[0]

    if (factura.estado === "anulada") {
      return NextResponse.json({ error: "No se puede pagar una factura anulada" }, { status: 400 })
    }

    const saldoActual = Number.parseFloat(factura.saldo)

    if (monto > saldoActual) {
      return NextResponse.json({ error: "El monto excede el saldo pendiente" }, { status: 400 })
    }

    // Register payment
    await sql`
      INSERT INTO proveedor_pagos (factura_id, monto, metodo, referencia, observacion)
      VALUES (${facturaId}, ${monto}, ${metodo || null}, ${referencia || null}, ${observacion || null})
    `

    // Update factura
    const nuevoPagado = Number.parseFloat(factura.pagado) + Number.parseFloat(monto)
    const nuevoSaldo = Number.parseFloat(factura.total) - nuevoPagado
    const nuevoEstado = nuevoSaldo <= 0 ? "pagada" : "pendiente"

    const updatedFactura = await sql`
      UPDATE proveedor_facturas
      SET pagado = ${nuevoPagado},
          saldo = ${nuevoSaldo},
          estado = ${nuevoEstado}
      WHERE id = ${facturaId}
      RETURNING *
    `

    return NextResponse.json({ factura: updatedFactura[0] })
  } catch (error: any) {
    console.error("[v0] Pagar factura error:", error)
    return NextResponse.json({ error: error.message || "Error al registrar pago" }, { status: 500 })
  }
}
