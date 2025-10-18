import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { obtenerConsolidacionServientrega, actualizarTotalesCuenta } from "@/lib/envios"
import { sql } from "@/lib/db"

// GET - Obtener consolidación de Servientrega
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["administrador", "asistente"])

    const { searchParams } = new URL(request.url)
    const year = Number.parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = Number.parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Mes inválido" }, { status: 400 })
    }

    const consolidacion = await obtenerConsolidacionServientrega(year, month)

    return NextResponse.json({ ...consolidacion, year, month })
  } catch (error: any) {
    console.error("[v0] Get consolidacion Servientrega error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener consolidación" }, { status: 500 })
  }
}

// POST - Agregar envío a cuenta Servientrega
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { envio_id, year, month } = await request.json()

    if (!envio_id || !year || !month) {
      return NextResponse.json({ error: "Envío, año y mes son requeridos" }, { status: 400 })
    }

    const periodo = `${year}-${month.toString().padStart(2, "0")}`

    // Obtener o crear cuenta
    let cuentaResult = await sql`SELECT id FROM servientrega_cuenta WHERE periodo = ${periodo}`

    if (cuentaResult.length === 0) {
      const endDate = new Date(year, month, 0)
      await sql`
        INSERT INTO servientrega_cuenta (periodo, fecha_corte, total_cargos, total_pagado, saldo)
        VALUES (${periodo}, ${endDate.toISOString().split("T")[0]}, 0, 0, 0)
      `
      cuentaResult = await sql`SELECT id FROM servientrega_cuenta WHERE periodo = ${periodo}`
    }

    const cuentaId = cuentaResult[0].id

    // Obtener costo del envío
    const envioResult = await sql`SELECT costo FROM envios WHERE id = ${envio_id}`

    if (envioResult.length === 0) {
      return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 })
    }

    const costo = Number.parseFloat(envioResult[0].costo)

    // Agregar detalle
    await sql`
      INSERT INTO servientrega_detalle (cuenta_id, envio_id, monto)
      VALUES (${cuentaId}, ${envio_id}, ${costo})
      ON CONFLICT DO NOTHING
    `

    // Actualizar totales
    await actualizarTotalesCuenta(cuentaId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Add to Servientrega error:", error)
    return NextResponse.json({ error: error.message || "Error al agregar a cuenta" }, { status: 500 })
  }
}
