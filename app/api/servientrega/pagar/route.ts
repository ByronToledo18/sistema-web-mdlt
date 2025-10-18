import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

// POST - Registrar pago a Servientrega
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { cuenta_id, monto, metodo, referencia } = await request.json()

    if (!cuenta_id || !monto) {
      return NextResponse.json({ error: "Cuenta y monto son requeridos" }, { status: 400 })
    }

    if (!metodo || !referencia) {
      return NextResponse.json({ error: "Medio de pago y referencia son requeridos" }, { status: 400 })
    }

    if (monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
    }

    // Obtener cuenta
    const cuentaResult = await sql`
      SELECT total_cargos, total_pagado FROM servientrega_cuenta WHERE id = ${cuenta_id}
    `

    if (cuentaResult.length === 0) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 })
    }

    const totalCargos = Number.parseFloat(cuentaResult[0].total_cargos)
    const totalPagado = Number.parseFloat(cuentaResult[0].total_pagado)
    const nuevoTotalPagado = totalPagado + monto

    if (nuevoTotalPagado > totalCargos) {
      return NextResponse.json(
        {
          error: `El monto excede el saldo. Saldo pendiente: $${(totalCargos - totalPagado).toFixed(2)}`,
        },
        { status: 400 },
      )
    }

    await sql`
      INSERT INTO servientrega_pagos (cuenta_id, monto, metodo, referencia, fecha)
      VALUES (${cuenta_id}, ${monto}, ${metodo}, ${referencia}, CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')
    `

    // Actualizar cuenta
    await sql`
      UPDATE servientrega_cuenta
      SET total_pagado = ${nuevoTotalPagado}, saldo = total_cargos - ${nuevoTotalPagado}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${cuenta_id}
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Pagar Servientrega error:", error)
    return NextResponse.json({ error: error.message || "Error al registrar pago" }, { status: 500 })
  }
}
