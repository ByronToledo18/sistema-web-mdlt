import "server-only"

import { and, desc, eq, gte, lte } from "drizzle-orm"
import { db } from "@/server/db/client"
import { auditoria, usuarios } from "@/server/db/schema"
import { logger } from "@/lib/logger"

export interface RegistrarAuditoria {
  usuario_id?: number
  accion: string
  modulo: string
  descripcion?: string
  ip_address?: string
  user_agent?: string
  metadata?: unknown
}

// Registra una acción en la auditoría. Nunca lanza: una falla de auditoría no
// debe bloquear la operación del usuario, pero queda en el log con todo lo
// necesario para reconstruir el registro.
//
// Se llama DESPUÉS de que la transacción de la operación hizo commit (con
// `db`, no con el `tx`): un INSERT fallido dentro de una transacción la
// aborta entera aunque el error se capture.
export async function registrarAuditoria(params: RegistrarAuditoria): Promise<void> {
  try {
    await db.insert(auditoria).values({
      usuario_id: params.usuario_id ?? null,
      accion: params.accion,
      modulo: params.modulo,
      descripcion: params.descripcion ?? null,
      ip_address: params.ip_address ?? null,
      user_agent: params.user_agent ?? null,
      metadata: params.metadata ?? null,
    })
  } catch (error) {
    logger.error("services/auditoria: registro perdido", error, {
      usuario_id: params.usuario_id ?? null,
      accion: params.accion,
      modulo: params.modulo,
      descripcion: params.descripcion ?? null,
    })
  }
}

export interface FiltrosAuditoria {
  usuario_id?: number
  modulo?: string
  accion?: string
  fecha_desde?: Date
  fecha_hasta?: Date
  limit: number
  offset: number
}

export async function listarAuditoria(filtros: FiltrosAuditoria) {
  return db
    .select({
      id: auditoria.id,
      usuario_id: auditoria.usuario_id,
      accion: auditoria.accion,
      modulo: auditoria.modulo,
      descripcion: auditoria.descripcion,
      ip_address: auditoria.ip_address,
      user_agent: auditoria.user_agent,
      metadata: auditoria.metadata,
      fecha: auditoria.fecha,
      usuario_nombre: usuarios.nombre,
      usuario_email: usuarios.email,
    })
    .from(auditoria)
    .leftJoin(usuarios, eq(auditoria.usuario_id, usuarios.id))
    .where(
      and(
        filtros.usuario_id ? eq(auditoria.usuario_id, filtros.usuario_id) : undefined,
        filtros.modulo ? eq(auditoria.modulo, filtros.modulo) : undefined,
        filtros.accion ? eq(auditoria.accion, filtros.accion) : undefined,
        filtros.fecha_desde ? gte(auditoria.fecha, filtros.fecha_desde) : undefined,
        filtros.fecha_hasta ? lte(auditoria.fecha, filtros.fecha_hasta) : undefined,
      ),
    )
    .orderBy(desc(auditoria.fecha))
    .limit(filtros.limit)
    .offset(filtros.offset)
}
