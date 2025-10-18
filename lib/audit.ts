import { sql, executeQuery } from "./db"

export interface AuditLog {
  id: number
  usuario_id: number | null
  accion: string
  modulo: string
  descripcion: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: any
  fecha: Date
}

export interface CreateAuditLogParams {
  usuario_id?: number
  accion: string
  modulo: string
  descripcion?: string
  ip_address?: string
  user_agent?: string
  metadata?: any
}

/**
 * Registra una acción en el log de auditoría
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await sql`
      INSERT INTO auditoria (usuario_id, accion, modulo, descripcion, ip_address, user_agent, metadata)
      VALUES (
        ${params.usuario_id || null},
        ${params.accion},
        ${params.modulo},
        ${params.descripcion || null},
        ${params.ip_address || null},
        ${params.user_agent || null},
        ${params.metadata ? JSON.stringify(params.metadata) : null}
      )
    `
  } catch (error) {
    console.error("[v0] Error creating audit log:", error)
    // No lanzamos error para no interrumpir el flujo principal
  }
}

/**
 * Obtiene logs de auditoría con filtros opcionales
 */
export async function getAuditLogs(filters?: {
  usuario_id?: number
  modulo?: string
  accion?: string
  fecha_desde?: Date
  fecha_hasta?: Date
  limit?: number
  offset?: number
}): Promise<AuditLog[]> {
  const limit = filters?.limit || 100
  const offset = filters?.offset || 0

  if (!filters || Object.keys(filters).filter((k) => k !== "limit" && k !== "offset").length === 0) {
    const result = await sql`
      SELECT 
        a.*,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      ORDER BY a.fecha DESC 
      LIMIT ${limit} 
      OFFSET ${offset}
    `
    return result as AuditLog[]
  }

  let baseQuery = `
    SELECT 
      a.*,
      u.nombre as usuario_nombre,
      u.email as usuario_email
    FROM auditoria a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    WHERE 1=1
  `

  const params: any[] = []

  if (filters.usuario_id) {
    baseQuery += ` AND a.usuario_id = $${params.length + 1}`
    params.push(filters.usuario_id)
  }

  if (filters.modulo) {
    baseQuery += ` AND a.modulo = $${params.length + 1}`
    params.push(filters.modulo)
  }

  if (filters.accion) {
    baseQuery += ` AND a.accion = $${params.length + 1}`
    params.push(filters.accion)
  }

  if (filters.fecha_desde) {
    baseQuery += ` AND a.fecha >= $${params.length + 1}`
    params.push(filters.fecha_desde.toISOString())
  }

  if (filters.fecha_hasta) {
    baseQuery += ` AND a.fecha <= $${params.length + 1}`
    params.push(filters.fecha_hasta.toISOString())
  }

  baseQuery += ` ORDER BY a.fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)

  const result = await executeQuery(baseQuery, params)
  return result as AuditLog[]
}

/**
 * Obtiene estadísticas de auditoría
 */
export async function getAuditStats(fecha_desde?: Date, fecha_hasta?: Date) {
  if (!fecha_desde && !fecha_hasta) {
    const result = await sql`
      SELECT 
        COUNT(*) as total_acciones,
        COUNT(DISTINCT usuario_id) as usuarios_activos,
        COUNT(DISTINCT modulo) as modulos_usados,
        DATE(fecha) as fecha
      FROM auditoria
      GROUP BY DATE(fecha) 
      ORDER BY fecha DESC 
      LIMIT 30
    `
    return result
  }

  let baseQuery = `
    SELECT 
      COUNT(*) as total_acciones,
      COUNT(DISTINCT usuario_id) as usuarios_activos,
      COUNT(DISTINCT modulo) as modulos_usados,
      DATE(fecha) as fecha
    FROM auditoria
    WHERE 1=1
  `

  const params: any[] = []

  if (fecha_desde) {
    baseQuery += ` AND fecha >= $${params.length + 1}`
    params.push(fecha_desde.toISOString())
  }

  if (fecha_hasta) {
    baseQuery += ` AND fecha <= $${params.length + 1}`
    params.push(fecha_hasta.toISOString())
  }

  baseQuery += ` GROUP BY DATE(fecha) ORDER BY fecha DESC LIMIT 30`

  const result = await executeQuery(baseQuery, params)
  return result
}
