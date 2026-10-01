import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { envios, pedidoItems, pedidos, servientregaCuenta, servientregaDetalle } from "@/server/db/schema"
import {
  actualizarEnvio,
  agregarEnvioACuenta,
  consolidacionServientrega,
  crearEnvio,
  eliminarEnvio,
  pagarServientrega,
} from "@/server/services/envios"
import { crearPedido } from "@/server/services/pedidos"
import { resetDb } from "../support/db-client"
import { admin, asistente, crearCliente, crearServicioEnvio } from "../support/fixtures"

beforeEach(async () => {
  await resetDb()
})

async function envioPendiente(costo = 4.5) {
  const cliente = await crearCliente()
  const pedido = await crearPedido(cliente.id)
  await crearServicioEnvio()
  return crearEnvio(admin, { pedido_id: pedido.id, costo })
}

describe("servientrega_detalle: un envío se carga una sola vez", () => {
  test("volver a despachar un envío no lo carga dos veces en la cuenta", async () => {
    const envio = await envioPendiente()
    await actualizarEnvio(envio.id, { estado: "en_proceso" })
    await actualizarEnvio(envio.id, { estado: "pendiente" })
    await actualizarEnvio(envio.id, { estado: "terminado" })

    const detalles = await db.select().from(servientregaDetalle).where(eq(servientregaDetalle.envio_id, envio.id))
    expect(detalles).toHaveLength(1)
    const [cuenta] = await db.select().from(servientregaCuenta)
    expect(cuenta.total_cargos).toBe("4.50")
  })

  test("la base rechaza un segundo detalle para el mismo envío", async () => {
    const envio = await envioPendiente()
    await actualizarEnvio(envio.id, { estado: "en_proceso" })
    const [detalle] = await db.select().from(servientregaDetalle)

    await expect(
      db.insert(servientregaDetalle).values({ cuenta_id: detalle.cuenta_id, envio_id: envio.id, monto: "1.00" }),
    ).rejects.toThrow()
  })
})

describe("crearEnvio", () => {
  test("agrega el ítem de envío, recalcula el total y deja el envío pendiente", async () => {
    const envio = await envioPendiente(4.5)
    expect(envio).toMatchObject({ estado: "pendiente", costo: "4.50" })
    expect(envio.guia).toMatch(/^SER-\d{4}-\d{6}$/)

    const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedido_id, envio.pedido_id))
    expect(items).toMatchObject([{ item_tipo: "servicio", descripcion: "Costo de Envío", subtotal: "4.50" }])
    const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, envio.pedido_id))
    expect(pedido.total).toBe("4.50")
  })

  test("sin el servicio Envío en el catálogo: 400", async () => {
    const cliente = await crearCliente()
    const pedido = await crearPedido(cliente.id)
    await expect(crearEnvio(admin, { pedido_id: pedido.id, costo: 3 })).rejects.toMatchObject({ status: 400 })
  })

  test("pedido cerrado: nadie crea envíos (agregan un ítem), ni el administrador", async () => {
    const cliente = await crearCliente()
    const pedido = await crearPedido(cliente.id)
    await crearServicioEnvio()
    await db.update(pedidos).set({ estado: "terminado" }).where(eq(pedidos.id, pedido.id))
    await expect(crearEnvio(asistente, { pedido_id: pedido.id, costo: 3 })).rejects.toMatchObject({ status: 400 })
    await expect(crearEnvio(admin, { pedido_id: pedido.id, costo: 3 })).rejects.toMatchObject({ status: 400 })
  })

  test("pedido inexistente: 404", async () => {
    await crearServicioEnvio()
    await expect(crearEnvio(admin, { pedido_id: 999, costo: 3 })).rejects.toMatchObject({ status: 404 })
  })
})

describe("actualizarEnvio", () => {
  test("sin campos: 400; envío inexistente: 404", async () => {
    await expect(actualizarEnvio(1, {})).rejects.toMatchObject({ status: 400 })
    await expect(actualizarEnvio(999, { estado: "en_proceso" })).rejects.toMatchObject({ status: 404 })
  })

  test("reemplaza la guía interna por la real y actualiza el costo sin cargar la cuenta", async () => {
    const envio = await envioPendiente()
    const actualizado = await actualizarEnvio(envio.id, { guia: "1234567890", costo: 6 })
    expect(actualizado).toMatchObject({ guia: "1234567890", costo: "6.00", estado: "pendiente" })
    expect(await db.select().from(servientregaDetalle)).toHaveLength(0)
  })

  test("al despachar carga el costo vigente a la cuenta del período", async () => {
    const envio = await envioPendiente(4)
    await actualizarEnvio(envio.id, { costo: 7.25 })
    await actualizarEnvio(envio.id, { estado: "terminado" })

    const [cuenta] = await db.select().from(servientregaCuenta)
    expect(cuenta).toMatchObject({ total_cargos: "7.25", total_pagado: "0.00", saldo: "7.25" })
  })

  test("en_proceso → terminado no vuelve a cargar el envío", async () => {
    const envio = await envioPendiente(3)
    await actualizarEnvio(envio.id, { estado: "en_proceso" })
    await actualizarEnvio(envio.id, { estado: "terminado" })
    const [cuenta] = await db.select().from(servientregaCuenta)
    expect(cuenta.total_cargos).toBe("3.00")
  })
})

describe("eliminarEnvio", () => {
  test("borra un envío pendiente; inexistente: 404", async () => {
    const envio = await envioPendiente()
    await eliminarEnvio(envio.id)
    expect(await db.select().from(envios)).toHaveLength(0)
    await expect(eliminarEnvio(envio.id)).rejects.toMatchObject({ status: 404 })
  })

  test("un envío ya cargado en la cuenta no se elimina (400)", async () => {
    const envio = await envioPendiente()
    await actualizarEnvio(envio.id, { estado: "en_proceso" })
    await expect(eliminarEnvio(envio.id)).rejects.toMatchObject({ status: 400 })
    expect(await db.select().from(envios)).toHaveLength(1)
  })
})

describe("cuenta Servientrega", () => {
  test("agregarEnvioACuenta carga en el período pedido y no duplica", async () => {
    const envio = await envioPendiente(5)
    await agregarEnvioACuenta({ envio_id: envio.id, year: 2026, month: 2 })
    await agregarEnvioACuenta({ envio_id: envio.id, year: 2026, month: 3 })

    const feb = await consolidacionServientrega(2026, 2)
    expect(feb.cuenta).toMatchObject({ periodo: "2026-02", total_cargos: 5, saldo: 5 })
    expect(feb.detalles.map((d) => d.envio_id)).toEqual([envio.id])
    const mar = await consolidacionServientrega(2026, 3)
    expect(mar.detalles).toEqual([])
  })

  test("agregarEnvioACuenta con un envío inexistente: 404", async () => {
    await expect(agregarEnvioACuenta({ envio_id: 999, year: 2026, month: 2 })).rejects.toMatchObject({ status: 404 })
  })

  test("pagos parciales bajan el saldo y no se puede pagar de más", async () => {
    const envio = await envioPendiente(10)
    await agregarEnvioACuenta({ envio_id: envio.id, year: 2026, month: 2 })
    const { cuenta } = await consolidacionServientrega(2026, 2)

    await pagarServientrega({ cuenta_id: cuenta.id, monto: 4, metodo: "transferencia", referencia: "A1" })
    await expect(
      pagarServientrega({ cuenta_id: cuenta.id, monto: 6.01, metodo: "transferencia", referencia: "A2" }),
    ).rejects.toMatchObject({ status: 400 })
    await pagarServientrega({ cuenta_id: cuenta.id, monto: 6, metodo: "efectivo", referencia: "A3" })

    expect((await consolidacionServientrega(2026, 2)).cuenta).toMatchObject({
      total_cargos: 10,
      total_pagado: 10,
      saldo: 0,
    })
    await expect(
      pagarServientrega({ cuenta_id: 999, monto: 1, metodo: "efectivo", referencia: "X" }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
