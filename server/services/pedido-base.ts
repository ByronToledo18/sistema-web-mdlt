import "server-only"

import { eq, sql, sum } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { anioNegocio } from "@/lib/fechas"
import { HttpError } from "@/lib/http"
import { can } from "@/server/auth/guard"
import type { Executor } from "@/server/db/client"
import { pagos, pedidoItems, pedidos } from "@/server/db/schema"
import { siguienteCodigo, toCents } from "./_shared"

// Piezas de pedidos que usan también pagos y envíos (separadas de
// pedidos.ts para no tener imports circulares).

export function generarCodigoPedido(ex: Executor): Promise<string> {
  const year = anioNegocio()
  return siguienteCodigo(ex, {
    prefix: `TUTU-${year}-`,
    seqName: `pedido_codigo_seq_tutu_${year}`,
    padding: 4,
    seed: { table: "pedidos", column: "codigo" },
  })
}

// Lee el pedido y bloquea su fila hasta el fin de la transacción. Serializa
// las operaciones concurrentes sobre un mismo pedido (dos cobros a la vez no
// pueden superar el saldo, el total no se recalcula con datos viejos).
export async function bloquearPedido(ex: Executor, pedidoId: number) {
  const [pedido] = await ex.select().from(pedidos).where(eq(pedidos.id, pedidoId)).for("update")
  if (!pedido) {
    throw new HttpError(404, "Pedido no encontrado")
  }
  return pedido
}

export const ESTADOS_CERRADOS = ["terminado", "anulado", "entregado"] as const

export function estaCerrado(estado: string | null): boolean {
  return (ESTADOS_CERRADOS as readonly (string | null)[]).includes(estado)
}

// Un pedido cerrado (terminado, anulado o entregado) solo lo modifica quien
// tenga permiso (hoy, el administrador).
export function assertPedidoEditable(user: UserPayload, estado: string | null, mensaje: string): void {
  if (estaCerrado(estado) && !can(user, "pedidos_cerrados", "update")) {
    throw new HttpError(403, mensaje)
  }
}

// Al anular un pedido su stock vuelve al inventario. Mientras siga anulado
// sus ítems no se tocan (ni siquiera el administrador): moverían un stock que
// ya no está descontado. Hay que reabrirlo primero.
export function assertNoAnulado(estado: string | null): void {
  if (estado === "anulado") {
    throw new HttpError(400, "El pedido está anulado: reábrelo antes de modificar sus ítems")
  }
}

// Saldo pendiente del pedido, en centavos (total − cobros).
export async function saldoPendienteCents(ex: Executor, pedido: { id: number; total: string | null }): Promise<number> {
  const [{ pagado }] = await ex
    .select({ pagado: sum(pagos.monto) })
    .from(pagos)
    .where(eq(pagos.pedido_id, pedido.id))
  return toCents(pedido.total) - toCents(pagado)
}

export async function recalcularTotalPedido(ex: Executor, pedidoId: number): Promise<void> {
  await ex
    .update(pedidos)
    .set({
      total: sql`(SELECT COALESCE(SUM(${pedidoItems.subtotal}), 0) FROM ${pedidoItems} WHERE ${pedidoItems.pedido_id} = ${pedidoId})`,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(pedidos.id, pedidoId))
}
