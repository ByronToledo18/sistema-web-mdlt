import { sql, executeQuery } from "./db"

// Generar código único para pedido: TUTU-YYYY-#### (formato acordado con el
// cliente en la documentación del proyecto - el código anterior generaba
// YYYY-MM-#### por error).
// Usa una secuencia de Postgres real (nextval es atómico) en vez de
// SELECT MAX(...)+1, que tenía una condición de carrera: dos pedidos creados
// en simultáneo podían leer el mismo máximo y terminar con el mismo código.
export async function generatePedidoCodigo(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TUTU-${year}-`
  const seqName = `pedido_codigo_seq_tutu_${year}`

  const exists = await executeQuery(`SELECT to_regclass($1) as reg`, [seqName])
  if (!exists[0]?.reg) {
    // Primera vez que se usa este período: sembrar la secuencia con el máximo
    // ya existente (por si hay códigos generados antes de este fix, en el
    // formato viejo o nuevo), para no colisionar con ellos.
    const maxResult = await executeQuery(
      `SELECT MAX(CAST(SUBSTRING(codigo FROM 11) AS INTEGER)) as max_numero
       FROM pedidos
       WHERE codigo LIKE $1`,
      [`${prefix}%`],
    )
    const startAt = (maxResult[0]?.max_numero ? Number.parseInt(maxResult[0].max_numero) : 0) + 1
    await executeQuery(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START ${startAt}`, [])
  }

  const result = await executeQuery(`SELECT nextval($1::regclass) as siguiente`, [seqName])
  const nextNumber = Number(result[0].siguiente)

  // Formatear con 4 dígitos
  const codigo = `${prefix}${nextNumber.toString().padStart(4, "0")}`

  return codigo
}

// Calcular total del pedido basado en sus items
export async function calcularTotalPedido(pedidoId: number): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(subtotal), 0) as total
    FROM pedido_items
    WHERE pedido_id = ${pedidoId}
  `

  return Number.parseFloat(result[0]?.total || "0")
}

// Actualizar el total del pedido
export async function actualizarTotalPedido(pedidoId: number): Promise<void> {
  const total = await calcularTotalPedido(pedidoId)

  await sql`
    UPDATE pedidos
    SET total = ${total}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${pedidoId}
  `
}
