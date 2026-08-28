import { sql, executeQuery } from "./db"

export interface NominaMov {
  id: number
  persona_tipo: string
  persona_id: number | null
  pedido_id: number | null
  concepto: string
  monto: string
  fecha: string
  tipo: "pago" | "deduccion" | "bono"
  created_at: string
}

export interface RegistrarMovimientoParams {
  persona_tipo: string
  concepto: string
  monto: number
  fecha: string
  tipo: "pago" | "deduccion" | "bono"
  pedido_id?: number | null
}

// Registra un movimiento manual de nómina (pago, deducción o bono a una persona).
// No hay tabla de personas en el esquema - persona_tipo es la categoría
// (madre, costurera_externa, emprendedora, otro) y el nombre de la persona va
// dentro de `concepto`, que ya es un campo libre en nomina_mov.
export async function registrarMovimiento(params: RegistrarMovimientoParams): Promise<NominaMov> {
  const result = await sql`
    INSERT INTO nomina_mov (persona_tipo, persona_id, pedido_id, concepto, monto, fecha, tipo)
    VALUES (
      ${params.persona_tipo},
      NULL,
      ${params.pedido_id || null},
      ${params.concepto},
      ${params.monto},
      ${params.fecha},
      ${params.tipo}
    )
    RETURNING *
  `
  return result[0] as NominaMov
}

export async function getMovimiento(id: number): Promise<NominaMov | null> {
  const result = await sql`SELECT * FROM nomina_mov WHERE id = ${id}`
  return (result[0] as NominaMov) || null
}

export async function getMovimientos(filters?: {
  persona_tipo?: string
  tipo?: string
  fecha_desde?: string
  fecha_hasta?: string
  limit?: number
  offset?: number
}): Promise<NominaMov[]> {
  const limit = filters?.limit || 100
  const offset = filters?.offset || 0

  let baseQuery = `
    SELECT nm.*, p.codigo as pedido_codigo
    FROM nomina_mov nm
    LEFT JOIN pedidos p ON nm.pedido_id = p.id
    WHERE 1=1
  `
  const params: any[] = []

  if (filters?.persona_tipo) {
    baseQuery += ` AND nm.persona_tipo = $${params.length + 1}`
    params.push(filters.persona_tipo)
  }

  if (filters?.tipo) {
    baseQuery += ` AND nm.tipo = $${params.length + 1}`
    params.push(filters.tipo)
  }

  if (filters?.fecha_desde) {
    baseQuery += ` AND nm.fecha >= $${params.length + 1}`
    params.push(filters.fecha_desde)
  }

  if (filters?.fecha_hasta) {
    baseQuery += ` AND nm.fecha <= $${params.length + 1}`
    params.push(filters.fecha_hasta)
  }

  baseQuery += ` ORDER BY nm.fecha DESC, nm.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)

  const result = await executeQuery(baseQuery, params)
  return result as NominaMov[]
}

// Consolidado por persona_tipo: total de pagos/bonos menos deducciones.
export async function getConsolidadoPorPersona(fecha_desde?: string, fecha_hasta?: string) {
  let baseQuery = `
    SELECT
      persona_tipo,
      COUNT(*) as movimientos,
      COALESCE(SUM(CASE WHEN tipo IN ('pago', 'bono') THEN monto ELSE 0 END), 0) as total_pagado,
      COALESCE(SUM(CASE WHEN tipo = 'deduccion' THEN monto ELSE 0 END), 0) as total_deducido
    FROM nomina_mov
    WHERE 1=1
  `
  const params: any[] = []

  if (fecha_desde) {
    baseQuery += ` AND fecha >= $${params.length + 1}`
    params.push(fecha_desde)
  }

  if (fecha_hasta) {
    baseQuery += ` AND fecha <= $${params.length + 1}`
    params.push(fecha_hasta)
  }

  baseQuery += ` GROUP BY persona_tipo ORDER BY total_pagado DESC`

  const result = await executeQuery(baseQuery, params)
  return result
}

export async function eliminarMovimiento(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM nomina_mov WHERE id = ${id} RETURNING id`
  return result.length > 0
}
