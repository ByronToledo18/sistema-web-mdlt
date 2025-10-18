import { sql, executeQuery } from "./db"

// Generar código único para pedido: YYYY-MM-####
export async function generatePedidoCodigo(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, "0")
  const prefix = `${year}-${month}-`

  const result = await executeQuery(
    `SELECT MAX(CAST(SUBSTRING(codigo FROM 9) AS INTEGER)) as max_numero
     FROM pedidos
     WHERE codigo LIKE $1`,
    [`${prefix}%`],
  )

  const lastNumber = result[0]?.max_numero ? Number.parseInt(result[0].max_numero) : 0
  const nextNumber = lastNumber + 1

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
