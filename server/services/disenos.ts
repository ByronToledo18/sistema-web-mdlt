import "server-only"

import { and, count, eq, gte } from "drizzle-orm"
import { hoyNegocio, inicioDelDia } from "@/lib/fechas"
import { db } from "@/server/db/client"
import { disenosPersonalizados } from "@/server/db/schema"

// Diseños con IA que el cliente generó hoy (día del calendario de Ecuador).
// Antes se comparaba con CURRENT_DATE, que en Neon es el día de UTC: desde
// las 19:00 de Ecuador el límite diario se reiniciaba antes de tiempo.
export async function contarDisenosDeHoy(clienteId: number, ahora: Date = new Date()): Promise<number> {
  const [fila] = await db
    .select({ total: count() })
    .from(disenosPersonalizados)
    .where(
      and(
        eq(disenosPersonalizados.cliente_id, clienteId),
        gte(disenosPersonalizados.created_at, inicioDelDia(hoyNegocio(ahora))),
      ),
    )
  return fila?.total ?? 0
}
