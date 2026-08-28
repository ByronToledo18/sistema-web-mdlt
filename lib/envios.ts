import { sql, executeQuery } from "./db"

// Generar número de guía interno de seguimiento (no es la guía real de
// Servientrega - ver app/admin/envios/page.tsx, que ahora pide al admin
// ingresar la guía real generada manualmente en el portal de Servientrega).
// Usa una secuencia de Postgres real (nextval es atómico) en vez de
// SELECT MAX(...)+1, que tenía una condición de carrera.
export async function generarNumeroGuia(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SER-${year}-`
  const seqName = `envio_guia_seq_${year}`

  const exists = await executeQuery(`SELECT to_regclass($1) as reg`, [seqName])
  if (!exists[0]?.reg) {
    const maxResult = await executeQuery(
      `SELECT MAX(CAST(SUBSTRING(guia FROM 10) AS INTEGER)) as max_numero
       FROM envios
       WHERE guia LIKE $1`,
      [`${prefix}%`],
    )
    const startAt = (maxResult[0]?.max_numero ? Number.parseInt(maxResult[0].max_numero) : 0) + 1
    await executeQuery(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START ${startAt}`, [])
  }

  const result = await executeQuery(`SELECT nextval($1::regclass) as siguiente`, [seqName])
  const nextNumber = Number(result[0].siguiente)

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
