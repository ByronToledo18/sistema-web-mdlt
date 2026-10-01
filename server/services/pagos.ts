import "server-only"

import { and, count, desc, eq, getTableColumns, gte, inArray, lt, sum } from "drizzle-orm"
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

// pagos.fecha es un instante (UTC). Un rango de días del calendario de Ecuador
// (UTC-5, sin horario de verano) va desde las 00:00 del primer día hasta antes
// de las 00:00 del día siguiente al último: así el último día entra completo.
// Antes se hacía new Date("YYYY-MM-DD"), que es medianoche UTC, y se perdía.
function rangoDias(desde: string, hasta: string) {
  const inicio = new Date(`${desde.slice(0, 10)}T00:00:00-05:00`)
  const fin = new Date(new Date(`${hasta.slice(0, 10)}T00:00:00-05:00`).getTime() + 24 * 60 * 60 * 1000)
  return and(gte(pagos.fecha, inicio), lt(pagos.fecha, fin))
}

// Primer y último día de un mes, como "YYYY-MM-DD".
export function mesEnDias(year: number, month: number): [string, string] {
  const mm = String(month).padStart(2, "0")
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [`${year}-${mm}-01`, `${year}-${mm}-${ultimo}`]
}

// Cobros del mes y total de los pedidos que recibieron al menos un cobro en el
// mes. Cada pedido se suma una sola vez, por id (antes era SUM(DISTINCT total),
// que juntaba pedidos distintos con el mismo total).
export async function consolidacionMensual(year: number, month: number) {
  const rango = rangoDias(...mesEnDias(year, month))

  const [cobros] = await db
    .select({ total_pagos: sum(pagos.monto), cantidad_pagos: count(pagos.id) })
    .from(pagos)
    .where(rango)

  const pedidosConCobro = db.selectDistinct({ id: pagos.pedido_id }).from(pagos).where(rango)
  const [delMes] = await db
    .select({ total_pedidos: sum(pedidos.total), cantidad_pedidos: count(pedidos.id) })
    .from(pedidos)
    .where(inArray(pedidos.id, pedidosConCobro))

  return {
    total_pagos: Number.parseFloat(cobros?.total_pagos ?? "0"),
    cantidad_pagos: cobros?.cantidad_pagos ?? 0,
    total_pedidos: Number.parseFloat(delMes?.total_pedidos ?? "0"),
    cantidad_pedidos: delMes?.cantidad_pedidos ?? 0,
  }
}

// Cobros entre dos días del calendario de Ecuador ("YYYY-MM-DD"), ambos incluidos.
export async function pagosPorRango(desde: string, hasta: string) {
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
    .where(rangoDias(desde, hasta))
    .orderBy(desc(pagos.fecha))
}
