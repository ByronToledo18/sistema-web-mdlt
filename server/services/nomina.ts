import "server-only"

import { and, asc, count, desc, eq, getTableColumns, gte, lte, sql } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import { db } from "@/server/db/client"
import { nominaMov, pedidos } from "@/server/db/schema"
import type { FiltrosNomina, RegistrarMovimiento } from "@/server/validators/nomina"
import { money, paginar, pgErrorCode, PG_FOREIGN_KEY_VIOLATION } from "./_shared"

// No hay tabla de personas: persona_tipo es la categoría (madre,
// costurera_externa, emprendedora, otro) y el nombre va en `concepto`.

export async function registrarMovimiento(input: RegistrarMovimiento) {
  try {
    const [movimiento] = await db
      .insert(nominaMov)
      .values({
        persona_tipo: input.persona_tipo,
        persona_id: null,
        pedido_id: input.pedido_id,
        concepto: input.concepto,
        monto: money(input.monto),
        fecha: input.fecha,
        tipo: input.tipo,
      })
      .returning()
    return movimiento
  } catch (error) {
    if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
      throw new HttpError(400, "El pedido indicado no existe")
    }
    throw error
  }
}

export async function obtenerMovimiento(id: number) {
  const [movimiento] = await db.select().from(nominaMov).where(eq(nominaMov.id, id))
  if (!movimiento) throw new HttpError(404, "Movimiento no encontrado")
  return movimiento
}

function consultaMovimientos(filtros: FiltrosNomina) {
  return db
    .select({ ...getTableColumns(nominaMov), pedido_codigo: pedidos.codigo })
    .from(nominaMov)
    .leftJoin(pedidos, eq(nominaMov.pedido_id, pedidos.id))
    .where(
      and(
        filtros.persona_tipo ? eq(nominaMov.persona_tipo, filtros.persona_tipo) : undefined,
        filtros.tipo ? eq(nominaMov.tipo, filtros.tipo) : undefined,
        filtros.fecha_desde ? gte(nominaMov.fecha, filtros.fecha_desde) : undefined,
        filtros.fecha_hasta ? lte(nominaMov.fecha, filtros.fecha_hasta) : undefined,
      ),
    )
    .orderBy(desc(nominaMov.fecha), desc(nominaMov.id))
    .$dynamic()
}

export function paginaDeMovimientos(filtros: FiltrosNomina, pagina: number) {
  return paginar(consultaMovimientos(filtros), pagina)
}

// Todos los movimientos de un rango (fecha es `date`: ambos días incluidos),
// sin paginar. Para los reportes.
export async function movimientosPorRango(fecha_desde: string, fecha_hasta: string, persona_tipo?: string) {
  return db
    .select({ ...getTableColumns(nominaMov), pedido_codigo: pedidos.codigo })
    .from(nominaMov)
    .leftJoin(pedidos, eq(nominaMov.pedido_id, pedidos.id))
    .where(
      and(
        gte(nominaMov.fecha, fecha_desde),
        lte(nominaMov.fecha, fecha_hasta),
        persona_tipo ? eq(nominaMov.persona_tipo, persona_tipo) : undefined,
      ),
    )
    .orderBy(asc(nominaMov.fecha), asc(nominaMov.id))
}

// Consolidado por persona_tipo: pagos y bonos menos deducciones.
export async function consolidadoPorPersona(fecha_desde?: string, fecha_hasta?: string) {
  const totalPagado = sql<string>`COALESCE(SUM(CASE WHEN ${nominaMov.tipo} IN ('pago', 'bono') THEN ${nominaMov.monto} ELSE 0 END), 0)`
  return db
    .select({
      persona_tipo: nominaMov.persona_tipo,
      movimientos: count(),
      total_pagado: totalPagado,
      total_deducido: sql<string>`COALESCE(SUM(CASE WHEN ${nominaMov.tipo} = 'deduccion' THEN ${nominaMov.monto} ELSE 0 END), 0)`,
    })
    .from(nominaMov)
    .where(
      and(
        fecha_desde ? gte(nominaMov.fecha, fecha_desde) : undefined,
        fecha_hasta ? lte(nominaMov.fecha, fecha_hasta) : undefined,
      ),
    )
    .groupBy(nominaMov.persona_tipo)
    .orderBy(desc(totalPagado))
}

export async function eliminarMovimiento(id: number) {
  const [eliminado] = await db.delete(nominaMov).where(eq(nominaMov.id, id)).returning()
  if (!eliminado) throw new HttpError(404, "Movimiento no encontrado")
  return eliminado
}
