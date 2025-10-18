import { sql, executeQuery } from "./db"

// Calcular total pagado de un pedido
export async function calcularTotalPagado(pedidoId: number): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(monto), 0) as total
    FROM pagos
    WHERE pedido_id = ${pedidoId}
  `

  return Number.parseFloat(result[0]?.total || "0")
}

// Calcular saldo pendiente de un pedido
export async function calcularSaldoPendiente(
  pedidoId: number,
): Promise<{ total: number; pagado: number; saldo: number }> {
  const pedidoResult = await sql`SELECT total FROM pedidos WHERE id = ${pedidoId}`

  if (pedidoResult.length === 0) {
    throw new Error("Pedido no encontrado")
  }

  const total = Number.parseFloat(pedidoResult[0].total)
  const pagado = await calcularTotalPagado(pedidoId)
  const saldo = total - pagado

  return { total, pagado, saldo }
}

// Obtener consolidación mensual de pagos
export async function obtenerConsolidacionMensual(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const result = await executeQuery(
    `SELECT 
      COALESCE(SUM(p.monto), 0) as total_pagos,
      COUNT(DISTINCT p.id) as cantidad_pagos,
      COALESCE(SUM(DISTINCT ped.total), 0) as total_pedidos,
      COUNT(DISTINCT ped.id) as cantidad_pedidos
     FROM pagos p
     JOIN pedidos ped ON p.pedido_id = ped.id
     WHERE p.fecha >= $1 AND p.fecha <= $2`,
    [startDate.toISOString(), endDate.toISOString()],
  )

  return {
    total_pagos: Number.parseFloat(result[0]?.total_pagos || "0"),
    cantidad_pagos: Number.parseInt(result[0]?.cantidad_pagos || "0"),
    total_pedidos: Number.parseFloat(result[0]?.total_pedidos || "0"),
    cantidad_pedidos: Number.parseInt(result[0]?.cantidad_pedidos || "0"),
  }
}

// Obtener pagos por rango de fechas
export async function obtenerPagosPorRango(startDate: Date, endDate: Date) {
  return await executeQuery(
    `SELECT 
      p.id,
      p.pedido_id,
      ped.codigo as pedido_codigo,
      c.nombre as cliente_nombre,
      p.monto,
      p.metodo,
      p.fecha,
      p.referencia
     FROM pagos p
     JOIN pedidos ped ON p.pedido_id = ped.id
     JOIN clientes c ON ped.cliente_id = c.id
     WHERE p.fecha >= $1 AND p.fecha <= $2
     ORDER BY p.fecha DESC`,
    [startDate.toISOString(), endDate.toISOString()],
  )
}
