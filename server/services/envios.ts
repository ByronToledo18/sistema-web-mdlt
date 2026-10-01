import "server-only"

import { and, count, desc, eq, getTableColumns, sql, sum } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { anioNegocio } from "@/lib/fechas"
import { HttpError } from "@/lib/http"
import { db, withTx, type Executor } from "@/server/db/client"
import {
  clientes,
  ENVIO_ESTADOS,
  envios,
  pedidoItems,
  pedidos,
  servicios,
  servientregaCuenta,
  servientregaDetalle,
  servientregaPagos,
} from "@/server/db/schema"
import { fromCents, periodoActual, pgErrorCode, PG_FOREIGN_KEY_VIOLATION, siguienteCodigo, toCents } from "./_shared"
import { assertPedidoEditable, bloquearPedido, recalcularTotalPedido } from "./pedido-base"

// Nombre del servicio del catálogo que representa el costo de envío en
// pedido_items (item_tipo = 'servicio').
export const SERVICIO_ENVIO = "Envío"

// Guía interna de seguimiento (SER-YYYY-######). No es la guía real de
// Servientrega: esa la carga el admin a mano al actualizar el envío.
export function generarNumeroGuia(ex: Executor): Promise<string> {
  const year = anioNegocio()
  return siguienteCodigo(ex, {
    prefix: `SER-${year}-`,
    seqName: `envio_guia_seq_${year}`,
    padding: 6,
    seed: { table: "envios", column: "guia" },
  })
}

export async function buscarServicioEnvio(ex: Executor) {
  const [servicio] = await ex
    .select({ id: servicios.id })
    .from(servicios)
    .where(eq(servicios.nombre, SERVICIO_ENVIO))
    .limit(1)
  return servicio ?? null
}

// Si el pedido tiene un ítem de envío y todavía no tiene envío, lo crea en
// estado 'pendiente' con el costo de ese ítem. Se usa cuando el pedido queda
// pagado por completo y cuando se marca como terminado.
export async function crearEnvioAutomatico(ex: Executor, pedidoId: number): Promise<void> {
  const [itemEnvio] = await ex
    .select({ precio_unitario: pedidoItems.precio_unitario })
    .from(pedidoItems)
    .innerJoin(servicios, eq(pedidoItems.item_id, servicios.id))
    .where(
      and(
        eq(pedidoItems.pedido_id, pedidoId),
        eq(pedidoItems.item_tipo, "servicio"),
        eq(servicios.nombre, SERVICIO_ENVIO),
      ),
    )
    .limit(1)
  if (!itemEnvio) return

  const [{ value: existentes }] = await ex.select({ value: count() }).from(envios).where(eq(envios.pedido_id, pedidoId))
  if (existentes > 0) return

  await ex.insert(envios).values({
    pedido_id: pedidoId,
    guia: await generarNumeroGuia(ex),
    fecha_envio: sql`CURRENT_TIMESTAMP`,
    estado: "pendiente",
    costo: itemEnvio.precio_unitario,
  })
}

const envioConPedido = {
  ...getTableColumns(envios),
  pedido_codigo: pedidos.codigo,
  cliente_nombre: clientes.nombre,
}

export async function listarEnvios(pedidoId?: number) {
  return db
    .select(envioConPedido)
    .from(envios)
    .innerJoin(pedidos, eq(envios.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(pedidoId ? eq(envios.pedido_id, pedidoId) : undefined)
    .orderBy(desc(envios.created_at))
}

export async function obtenerEnvio(id: number) {
  const [envio] = await db
    .select({ ...envioConPedido, cliente_direccion: clientes.direccion })
    .from(envios)
    .innerJoin(pedidos, eq(envios.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(eq(envios.id, id))
  if (!envio) throw new HttpError(404, "Envío no encontrado")
  return envio
}

// Envío manual desde el detalle del pedido: agrega el ítem "Envío" con el
// costo indicado, recalcula el total y crea el envío pendiente.
export async function crearEnvio(user: UserPayload, input: { pedido_id: number; costo: number }) {
  return withTx(async (tx) => {
    const pedido = await bloquearPedido(tx, input.pedido_id)
    assertPedidoEditable(user, pedido.estado, "No se pueden crear envíos para un pedido terminado, anulado o entregado")

    const servicioEnvio = await buscarServicioEnvio(tx)
    if (!servicioEnvio) {
      throw new HttpError(400, `No existe el servicio "${SERVICIO_ENVIO}" en el catálogo`)
    }

    const costo = fromCents(toCents(input.costo))
    await tx.insert(pedidoItems).values({
      pedido_id: pedido.id,
      item_tipo: "servicio",
      item_id: servicioEnvio.id,
      descripcion: "Costo de Envío",
      cantidad: "1",
      precio_unitario: costo,
      subtotal: costo,
    })
    await recalcularTotalPedido(tx, pedido.id)

    const [envio] = await tx
      .insert(envios)
      .values({
        pedido_id: pedido.id,
        guia: await generarNumeroGuia(tx),
        fecha_envio: sql`CURRENT_TIMESTAMP`,
        estado: "pendiente",
        costo,
      })
      .returning()
    return envio
  })
}

// Obtiene la cuenta Servientrega del período (YYYY-MM), creándola si no existe.
async function obtenerOCrearCuenta(ex: Executor, periodo: string, fechaCorte: string | null) {
  await ex
    .insert(servientregaCuenta)
    .values({ periodo, fecha_corte: fechaCorte, total_cargos: "0", total_pagado: "0", saldo: "0" })
    .onConflictDoNothing({ target: servientregaCuenta.periodo })
  const [cuenta] = await ex.select().from(servientregaCuenta).where(eq(servientregaCuenta.periodo, periodo))
  return cuenta
}

async function recalcularCuenta(ex: Executor, cuentaId: number): Promise<void> {
  const [{ total }] = await ex
    .select({ total: sum(servientregaDetalle.monto) })
    .from(servientregaDetalle)
    .where(eq(servientregaDetalle.cuenta_id, cuentaId))
  const totalCargos = fromCents(toCents(total))
  await ex
    .update(servientregaCuenta)
    .set({
      total_cargos: totalCargos,
      saldo: sql`${totalCargos}::numeric - ${servientregaCuenta.total_pagado}`,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(servientregaCuenta.id, cuentaId))
}

// Agrega el envío a la cuenta del período si todavía no está en ninguna. El
// UNIQUE de envio_id hace que dos despachos simultáneos no lo carguen dos veces.
async function cargarEnvioACuenta(ex: Executor, envioId: number, monto: string, cuentaId: number): Promise<boolean> {
  const insertados = await ex
    .insert(servientregaDetalle)
    .values({ cuenta_id: cuentaId, envio_id: envioId, monto })
    .onConflictDoNothing({ target: servientregaDetalle.envio_id })
    .returning({ id: servientregaDetalle.id })
  if (insertados.length === 0) return false

  await recalcularCuenta(ex, cuentaId)
  return true
}

export async function actualizarEnvio(
  id: number,
  input: { estado?: (typeof ENVIO_ESTADOS)[number]; costo?: number; guia?: string | null },
) {
  const cambios: Partial<typeof envios.$inferInsert> = {}
  if (input.estado) cambios.estado = input.estado
  if (input.costo !== undefined) cambios.costo = fromCents(toCents(input.costo))
  // Reemplaza la guía interna por la guía real de Servientrega.
  if (input.guia) cambios.guia = input.guia
  if (Object.keys(cambios).length === 0) {
    throw new HttpError(400, "No hay campos para actualizar")
  }

  return withTx(async (tx) => {
    const [actual] = await tx.select().from(envios).where(eq(envios.id, id)).for("update")
    if (!actual) throw new HttpError(404, "Envío no encontrado")

    const [envio] = await tx
      .update(envios)
      .set({ ...cambios, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(envios.id, id))
      .returning()

    // Al despachar un envío pendiente, su costo se carga a la cuenta
    // Servientrega del mes en curso.
    if ((input.estado === "en_proceso" || input.estado === "terminado") && actual.estado === "pendiente") {
      const cuenta = await obtenerOCrearCuenta(tx, periodoActual(), null)
      await cargarEnvioACuenta(tx, envio.id, fromCents(toCents(envio.costo)), cuenta.id)
    }

    return envio
  })
}

export async function eliminarEnvio(id: number): Promise<void> {
  try {
    const eliminados = await db.delete(envios).where(eq(envios.id, id)).returning({ id: envios.id })
    if (eliminados.length === 0) throw new HttpError(404, "Envío no encontrado")
  } catch (error) {
    if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
      throw new HttpError(400, "No se puede eliminar un envío que ya está cargado en la cuenta de Servientrega")
    }
    throw error
  }
}

// --- Cuenta Servientrega ---------------------------------------------------------

function periodoDe(year: number, month: number) {
  return `${year}-${month.toString().padStart(2, "0")}`
}

function ultimoDiaDelMes(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0]
}

export async function consolidacionServientrega(year: number, month: number) {
  const cuenta = await obtenerOCrearCuenta(db, periodoDe(year, month), ultimoDiaDelMes(year, month))

  const detalles = await db
    .select({
      ...getTableColumns(servientregaDetalle),
      guia: envios.guia,
      pedido_codigo: pedidos.codigo,
      fecha_envio: envios.fecha_envio,
    })
    .from(servientregaDetalle)
    .innerJoin(envios, eq(servientregaDetalle.envio_id, envios.id))
    .innerJoin(pedidos, eq(envios.pedido_id, pedidos.id))
    .where(eq(servientregaDetalle.cuenta_id, cuenta.id))
    .orderBy(desc(envios.fecha_envio))

  return {
    cuenta: {
      id: cuenta.id,
      periodo: cuenta.periodo,
      total_cargos: Number.parseFloat(cuenta.total_cargos ?? "0"),
      total_pagado: Number.parseFloat(cuenta.total_pagado ?? "0"),
      saldo: Number.parseFloat(cuenta.saldo ?? "0"),
    },
    detalles,
  }
}

export async function agregarEnvioACuenta(input: { envio_id: number; year: number; month: number }) {
  await withTx(async (tx) => {
    const [envio] = await tx.select({ costo: envios.costo }).from(envios).where(eq(envios.id, input.envio_id))
    if (!envio) throw new HttpError(404, "Envío no encontrado")

    const cuenta = await obtenerOCrearCuenta(
      tx,
      periodoDe(input.year, input.month),
      ultimoDiaDelMes(input.year, input.month),
    )
    // Bloquea la cuenta para que dos cargas simultáneas no dupliquen el envío.
    await tx
      .select({ id: servientregaCuenta.id })
      .from(servientregaCuenta)
      .where(eq(servientregaCuenta.id, cuenta.id))
      .for("update")
    await cargarEnvioACuenta(tx, input.envio_id, fromCents(toCents(envio.costo)), cuenta.id)
  })
}

export async function pagarServientrega(input: {
  cuenta_id: number
  monto: number
  metodo: string
  referencia: string
}) {
  await withTx(async (tx) => {
    const [cuenta] = await tx
      .select()
      .from(servientregaCuenta)
      .where(eq(servientregaCuenta.id, input.cuenta_id))
      .for("update")
    if (!cuenta) throw new HttpError(404, "Cuenta no encontrada")

    const cargos = toCents(cuenta.total_cargos)
    const pagado = toCents(cuenta.total_pagado)
    const monto = toCents(input.monto)
    if (pagado + monto > cargos) {
      throw new HttpError(400, `El monto excede el saldo. Saldo pendiente: $${fromCents(cargos - pagado)}`)
    }

    await tx.insert(servientregaPagos).values({
      cuenta_id: cuenta.id,
      monto: fromCents(monto),
      metodo: input.metodo,
      referencia: input.referencia,
    })
    await tx
      .update(servientregaCuenta)
      .set({
        total_pagado: fromCents(pagado + monto),
        saldo: fromCents(cargos - pagado - monto),
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(servientregaCuenta.id, cuenta.id))
  })
}
