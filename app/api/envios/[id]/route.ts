import { type NextRequest, NextResponse } from "next/server"
import { sql, executeQuery } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

// GET - Obtener envío
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador", "asistente"])
    const { id } = params

    const result = await sql`
      SELECT e.*, p.codigo as pedido_codigo, c.nombre as cliente_nombre, c.direccion as cliente_direccion
      FROM envios e
      JOIN pedidos p ON e.pedido_id = p.id
      JOIN clientes c ON p.cliente_id = c.id
      WHERE e.id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ envio: result[0] })
  } catch (error: any) {
    console.error("[v0] Get envio error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener envío" }, { status: 500 })
  }
}

// PUT - Actualizar envío
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(["administrador", "asistente"])
    const { id } = params
    const { estado, costo } = await request.json()

    const currentEnvio = await sql`SELECT * FROM envios WHERE id = ${id}`

    if (currentEnvio.length === 0) {
      return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 })
    }

    const previousEstado = currentEnvio[0].estado

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (estado) {
      updates.push(`estado = $${paramIndex}`)
      values.push(estado)
      paramIndex++
    }

    if (costo !== undefined) {
      updates.push(`costo = $${paramIndex}`)
      values.push(costo)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const query = `UPDATE envios SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`
    const result = await executeQuery(query, values)
    const rows = result.rows || result

    if (rows.length === 0) {
      return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 })
    }

    const updatedEnvio = rows[0]

    if ((estado === "en_proceso" || estado === "terminado") && previousEstado === "pendiente") {
      const periodo = new Date().toISOString().slice(0, 7) // YYYY-MM format

      // Get or create Servientrega account for current period
      let cuenta = await sql`
        SELECT * FROM servientrega_cuenta WHERE periodo = ${periodo}
      `

      if (cuenta.length === 0) {
        // Create new account for this period
        cuenta = await sql`
          INSERT INTO servientrega_cuenta (periodo, fecha_corte, total_cargos, total_pagado, saldo)
          VALUES (${periodo}, NULL, 0, 0, 0)
          RETURNING *
        `
      }

      const cuentaId = cuenta[0].id
      const costoEnvio = Number.parseFloat(updatedEnvio.costo || "0")

      // Check if already added to avoid duplicates
      const existingDetalle = await sql`
        SELECT * FROM servientrega_detalle WHERE envio_id = ${updatedEnvio.id}
      `

      if (existingDetalle.length === 0) {
        // Add shipment to Servientrega account detail
        await sql`
          INSERT INTO servientrega_detalle (cuenta_id, envio_id, monto)
          VALUES (${cuentaId}, ${updatedEnvio.id}, ${costoEnvio})
        `

        // Update account totals
        await sql`
          UPDATE servientrega_cuenta
          SET total_cargos = total_cargos + ${costoEnvio},
              saldo = saldo + ${costoEnvio}
          WHERE id = ${cuentaId}
        `
      }
    }

    return NextResponse.json({ envio: updatedEnvio })
  } catch (error: any) {
    console.error("[v0] Update envio error:", error)
    return NextResponse.json({ error: error.message || "Error al actualizar envío" }, { status: 500 })
  }
}

// DELETE - Eliminar envío
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(["administrador"])
    const { id } = params

    const result = await sql`DELETE FROM envios WHERE id = ${id} RETURNING *`

    if (result.length === 0) {
      return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete envio error:", error)
    return NextResponse.json({ error: error.message || "Error al eliminar envío" }, { status: 500 })
  }
}
