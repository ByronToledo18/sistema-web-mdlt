import { sql, executeQuery } from "./db"

// Generar número de guía simulado (en producción se integraría con API de Servientrega)
export async function generarNumeroGuia(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SER-${year}-`

  const result = await executeQuery(
    `SELECT MAX(CAST(SUBSTRING(guia FROM 10) AS INTEGER)) as max_numero
     FROM envios
     WHERE guia LIKE $1`,
    [`${prefix}%`],
  )

  const lastNumber = result[0]?.max_numero ? Number.parseInt(result[0].max_numero) : 0
  const nextNumber = lastNumber + 1

  return `${prefix}${nextNumber.toString().padStart(6, "0")}`
}

// Obtener consolidación mensual de Servientrega
export async function obtenerConsolidacionServientrega(year: number, month: number) {
  const periodo = `${year}-${month.toString().padStart(2, "0")}`

  // Verificar si existe la cuenta del período
  let cuentaResult = await sql`SELECT * FROM servientrega_cuenta WHERE periodo = ${periodo}`

  if (cuentaResult.length === 0) {
    // Crear cuenta si no existe
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    await sql`
      INSERT INTO servientrega_cuenta (periodo, fecha_corte, total_cargos, total_pagado, saldo)
      VALUES (${periodo}, ${endDate.toISOString().split("T")[0]}, 0, 0, 0)
    `

    cuentaResult = await sql`SELECT * FROM servientrega_cuenta WHERE periodo = ${periodo}`
  }

  const cuenta = cuentaResult[0]

  // Obtener detalles de la cuenta
  const detalles = await sql`
    SELECT sd.*, e.guia, p.codigo as pedido_codigo, e.fecha_envio
    FROM servientrega_detalle sd
    JOIN envios e ON sd.envio_id = e.id
    JOIN pedidos p ON e.pedido_id = p.id
    WHERE sd.cuenta_id = ${cuenta.id}
    ORDER BY e.fecha_envio DESC
  `

  return {
    cuenta: {
      id: cuenta.id,
      periodo: cuenta.periodo,
      total_cargos: Number.parseFloat(cuenta.total_cargos),
      total_pagado: Number.parseFloat(cuenta.total_pagado),
      saldo: Number.parseFloat(cuenta.saldo),
    },
    detalles,
  }
}

// Actualizar totales de cuenta Servientrega
export async function actualizarTotalesCuenta(cuentaId: number): Promise<void> {
  const result = await sql`
    SELECT COALESCE(SUM(monto), 0) as total
    FROM servientrega_detalle
    WHERE cuenta_id = ${cuentaId}
  `

  const totalCargos = Number.parseFloat(result[0]?.total || "0")

  await sql`
    UPDATE servientrega_cuenta
    SET total_cargos = ${totalCargos}, saldo = ${totalCargos} - total_pagado, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${cuentaId}
  `
}
