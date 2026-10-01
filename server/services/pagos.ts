import "server-only"

import { and, count, countDistinct, desc, eq, getTableColumns, gte, lte, sql, sum } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { HttpError } from "@/lib/http"
import { db, withTx } from "@/server/db/client"
import { clientes, pagos, pedidos } from "@/server/db/schema"
import { fromCents, toCents } from "./_shared"
import { crearEnvioAutomatico } from "./envios"
import { assertPedidoEditable, bloquearPedido } from "./pedido-base"

const pagoConPedido = {
  ...getTableColumns(pagos),
  pedido_codigo: pedidos.codigo,
  cliente_nombre: clientes.nombre,
}

export async function listarPagos(pedidoId?: number) {
  return db
    .select(pagoConPedido)
    .from(pagos)
    .innerJoin(pedidos, eq(pagos.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(pedidoId ? eq(pagos.pedido_id, pedidoId) : undefined)
    .orderBy(desc(pagos.fecha))
}

export async function obtenerPago(id: number) {
  const [pago] = await db
    .select(pagoConPedido)
    .from(pagos)
    .innerJoin(pedidos, eq(pagos.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(eq(pagos.id, id))
  if (!pago) throw new HttpError(404, "Pago no encontrado")
  return pago
}

export interface RegistrarPago {
  pedido_id: number
  monto: number
  metodo: string | null
  referencia: string | null
  observacion: string | null
}

// Registra un cobro sin superar el saldo del pedido. La fila del pedido queda
// bloqueada durante la transacción, así dos cobros simultáneos no pueden
// pagar de más. Si el cobro completa el saldo y el pedido tiene ítem de
// envío, se crea el envío pendiente en la misma transacción.
export async function registrarPago(user: UserPayload, input: RegistrarPago) {
  return withTx(async (tx) => {
    const pedido = await bloquearPedido(tx, input.pedido_id)
    assertPedidoEditable(user, pedido.estado, "No se pueden registrar pagos en un pedido terminado o anulado")

    const [{ pagado }] = await tx
      .select({ pagado: sum(pagos.monto) })
      .from(pagos)
      .where(eq(pagos.pedido_id, pedido.id))

    const total = toCents(pedido.total)
    const yaPagado = toCents(pagado)
    const monto = toCents(input.monto)

    if (yaPagado + monto > total) {
      throw new HttpError(400, `El monto excede el saldo pendiente. Saldo: $${fromCents(total - yaPagado)}`)
    }

    const [pago] = await tx
      .insert(pagos)
      .values({
        pedido_id: pedido.id,
        monto: fromCents(monto),
        metodo: input.metodo,
        referencia: input.referencia,
        observacion: input.observacion,
      })
      .returning()

    if (yaPagado + monto === total) {
      await crearEnvioAutomatico(tx, pedido.id)
    }

    return pago
  })
}

export async function eliminarPago(id: number): Promise<void> {
  const eliminados = await db.delete(pagos).where(eq(pagos.id, id)).returning({ id: pagos.id })
  if (eliminados.length === 0) throw new HttpError(404, "Pago no encontrado")
}

// --- Reportes de cobros ---------------------------------------------------------------

export async function consolidacionMensual(year: number, month: number) {
  const desde = new Date(year, month - 1, 1)
  const hasta = new Date(year, month, 0, 23, 59, 59)

  const [resultado] = await db
    .select({
      total_pagos: sum(pagos.monto),
      cantidad_pagos: count(pagos.id),
      total_pedidos: sql<string | null>`SUM(DISTINCT ${pedidos.total})`,
      cantidad_pedidos: countDistinct(pedidos.id),
    })
    .from(pagos)
    .innerJoin(pedidos, eq(pagos.pedido_id, pedidos.id))
    .where(and(gte(pagos.fecha, desde), lte(pagos.fecha, hasta)))

  return {
    total_pagos: Number.parseFloat(resultado?.total_pagos ?? "0"),
    cantidad_pagos: resultado?.cantidad_pagos ?? 0,
    total_pedidos: Number.parseFloat(resultado?.total_pedidos ?? "0"),
    cantidad_pedidos: resultado?.cantidad_pedidos ?? 0,
  }
}

export async function pagosPorRango(desde: Date, hasta: Date) {
  return db
    .select({
      id: pagos.id,
      pedido_id: pagos.pedido_id,
      pedido_codigo: pedidos.codigo,
      cliente_nombre: clientes.nombre,
      monto: pagos.monto,
      metodo: pagos.metodo,
      fecha: pagos.fecha,
      referencia: pagos.referencia,
    })
    .from(pagos)
    .innerJoin(pedidos, eq(pagos.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(and(gte(pagos.fecha, desde), lte(pagos.fecha, hasta)))
    .orderBy(desc(pagos.fecha))
}
