import "server-only"

import { eq, sql, sum } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { anioNegocio } from "@/lib/fechas"
import { HttpError } from "@/lib/http"
import { calcularTotales, ivaCents } from "@/lib/iva"
import { can } from "@/server/auth/guard"
import type { Executor } from "@/server/db/client"
import { pagos, pedidoItems, pedidos } from "@/server/db/schema"
import { fromCents, siguienteCodigo, toCents } from "./_shared"

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

// En un pedido cerrado (terminado, anulado o entregado), cambiar el estado
// (reabrirlo) y registrar cobros solo lo hace quien tenga permiso (hoy, el
// administrador). Los ítems y la eliminación de cobros no se permiten a nadie
// mientras siga cerrado (assertItemsEditables, eliminarPago).
export function assertPedidoEditable(user: UserPayload, estado: string | null, mensaje: string): void {
  if (estaCerrado(estado) && !can(user, "pedidos_cerrados", "update")) {
    throw new HttpError(403, mensaje)
  }
}

// Los ítems de un pedido cerrado (terminado, anulado o entregado) no se
// agregan, editan ni eliminan, para ningún rol (administrador incluido): un
// cerrado tiene saldo cero y cambiar su total dejaría saldo pendiente en un
// pedido ya cerrado (o, si está anulado, movería un stock que ya volvió al
// inventario). Para corregirlo, el administrador primero lo reabre (cambio de
// estado).
export function assertItemsEditables(estado: string | null, accion: string): void {
  if (estaCerrado(estado)) {
    throw new HttpError(400, `No se pueden ${accion} de un pedido terminado, anulado o entregado: reábrelo primero`)
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

// Columnas de dinero de una línea de pedido: subtotal = precio × cantidad
// (sin IVA) y el IVA de la línea redondeado a centavos (lib/iva.ts), que es
// solo informativo: el IVA del pedido se calcula sobre la base gravada.
// graba_iva se copia del producto/servicio al agregar la línea y no cambia
// después.
export function montosDeLinea(precioCents: number, cantidad: number, grabaIva: boolean) {
  const subtotal = Math.round(precioCents * cantidad)
  return {
    precio_unitario: fromCents(precioCents),
    subtotal: fromCents(subtotal),
    graba_iva: grabaIva,
    iva: fromCents(ivaCents(subtotal, grabaIva)),
  }
}

// Totales (lib/iva.ts calcularTotales) a partir de las líneas guardadas.
export function totalesDeLineas(lineas: { subtotal: string | null; graba_iva: boolean | null }[]) {
  return calcularTotales(lineas.map((l) => ({ subtotalCents: toCents(l.subtotal), grabaIva: !!l.graba_iva })))
}

// total del pedido = Σ subtotales + IVA sobre la base gravada
// (round(Σ subtotales que gravan × 15 %)). Es lo que se cobra (pagos, saldo,
// cierre) y lo que suma la factura.
export async function recalcularTotalPedido(ex: Executor, pedidoId: number): Promise<void> {
  const lineas = await ex
    .select({ subtotal: pedidoItems.subtotal, graba_iva: pedidoItems.graba_iva })
    .from(pedidoItems)
    .where(eq(pedidoItems.pedido_id, pedidoId))
  await ex
    .update(pedidos)
    .set({ total: fromCents(totalesDeLineas(lineas).total), updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(pedidos.id, pedidoId))
}
