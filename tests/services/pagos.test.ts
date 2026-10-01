import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { envios, pagos, pedidos } from "@/server/db/schema"
import { consolidacionMensual, pagosPorRango, registrarPago } from "@/server/services/pagos"
import { agregarItem, crearPedido } from "@/server/services/pedidos"
import { resetDb } from "../support/db-client"
import { admin, asistente, crearCliente, crearProducto, crearServicioEnvio } from "../support/fixtures"

beforeEach(resetDb)

// Pedido de $total con un producto y, opcionalmente, un ítem "Envío" de $envio
// (incluido en el total).
async function pedidoPorCobrar(total: number, envio = 0) {
  const cliente = await crearCliente()
  const pedido = await crearPedido(cliente.id)
  if (total > envio) {
    const producto = await crearProducto({ stock: 100 })
    await agregarItem(admin, pedido.id, {
      item_tipo: "producto",
      item_id: producto.id,
      descripcion: null,
      cantidad: 1,
      precio_unitario: total - envio,
    })
  }
  if (envio > 0) {
    const servicio = await crearServicioEnvio()
    await agregarItem(admin, pedido.id, {
      item_tipo: "servicio",
      item_id: servicio.id,
      descripcion: "Envío",
      cantidad: 1,
      precio_unitario: envio,
    })
  }
  return pedido
}

function pago(pedido_id: number, monto: number) {
  return { pedido_id, monto, metodo: "efectivo", referencia: null, observacion: null }
}

describe("registrarPago", () => {
  test("el pago que completa el saldo crea el envío pendiente", async () => {
    const pedido = await pedidoPorCobrar(30, 5)

    await registrarPago(asistente, pago(pedido.id, 10))
    expect(await db.select().from(envios)).toHaveLength(0)

    await registrarPago(asistente, pago(pedido.id, 20))
    const creados = await db.select().from(envios).where(eq(envios.pedido_id, pedido.id))
    expect(creados).toHaveLength(1)
    expect(creados[0]).toMatchObject({ estado: "pendiente", costo: "5.00" })
    expect(creados[0].guia).toBeTruthy()
  })

  test("sin ítem de envío, completar el saldo no crea envío", async () => {
    const pedido = await pedidoPorCobrar(30)
    await registrarPago(asistente, pago(pedido.id, 30))
    expect(await db.select().from(envios)).toHaveLength(0)
  })

  test("no permite cobrar más que el saldo", async () => {
    const pedido = await pedidoPorCobrar(30)
    await registrarPago(asistente, pago(pedido.id, 25))

    await expect(registrarPago(asistente, pago(pedido.id, 5.01))).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("5.00"),
    })
    expect(await db.select().from(pagos)).toHaveLength(1)
  })

  test("compara en centavos: 0.10 + 0.20 completa un saldo de 0.30", async () => {
    const pedido = await pedidoPorCobrar(0.3, 0.3)
    await registrarPago(asistente, pago(pedido.id, 0.1))
    await registrarPago(asistente, pago(pedido.id, 0.2))
    expect(await db.select().from(envios)).toHaveLength(1)
  })

  test("dos cobros simultáneos que juntos superan el saldo: uno se rechaza", async () => {
    const pedido = await pedidoPorCobrar(30)

    const resultados = await Promise.allSettled([
      registrarPago(asistente, pago(pedido.id, 20)),
      registrarPago(asistente, pago(pedido.id, 20)),
    ])

    expect(resultados.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"])
    expect(await db.select().from(pagos)).toHaveLength(1)
  })

  test("pedido terminado: solo el administrador registra cobros", async () => {
    const pedido = await pedidoPorCobrar(30)
    await db.update(pedidos).set({ estado: "terminado" }).where(eq(pedidos.id, pedido.id))

    await expect(registrarPago(asistente, pago(pedido.id, 10))).rejects.toMatchObject({ status: 403 })
    await expect(registrarPago(admin, pago(pedido.id, 10))).resolves.toMatchObject({ monto: "10.00" })
  })

  test("pedido inexistente: 404", async () => {
    await expect(registrarPago(admin, pago(999, 10))).rejects.toMatchObject({ status: 404 })
  })
})

describe("pagosPorRango", () => {
  // Cobros en los bordes del 30/09 en Ecuador (UTC-5).
  async function cobrosEnBordes() {
    const pedido = await pedidoPorCobrar(100)
    const fechas = [
      "2026-09-01T04:59:59Z", // 31/08 23:59:59 Ecuador: fuera
      "2026-09-01T05:00:00Z", // 01/09 00:00 Ecuador: dentro
      "2026-09-30T15:00:00Z", // 30/09 10:00 Ecuador: dentro (antes se perdía)
      "2026-10-01T04:59:59Z", // 30/09 23:59:59 Ecuador: dentro
      "2026-10-01T05:00:00Z", // 01/10 00:00 Ecuador: fuera
    ]
    await db.insert(pagos).values(fechas.map((f) => ({ pedido_id: pedido.id, monto: "10.00", fecha: new Date(f) })))
  }

  test("incluye el último día completo, en hora de Ecuador", async () => {
    await cobrosEnBordes()
    const filas = await pagosPorRango("2026-09-01", "2026-09-30")
    expect(filas.map((f) => f.fecha?.toISOString()).sort()).toEqual([
      "2026-09-01T05:00:00.000Z",
      "2026-09-30T15:00:00.000Z",
      "2026-10-01T04:59:59.000Z",
    ])
  })

  test("un rango de un solo día", async () => {
    await cobrosEnBordes()
    expect(await pagosPorRango("2026-09-30", "2026-09-30")).toHaveLength(2)
  })

  test("consolidacionMensual usa el mismo rango", async () => {
    await cobrosEnBordes()
    const resumen = await consolidacionMensual(2026, 9)
    expect(resumen).toMatchObject({ total_pagos: 30, cantidad_pagos: 3 })
  })
})

describe("consolidacionMensual", () => {
  test("dos pedidos con el mismo total se suman los dos", async () => {
    const a = await pedidoPorCobrar(50)
    const b = await pedidoPorCobrar(50)
    const enSeptiembre = new Date("2026-09-15T15:00:00Z")
    await db.insert(pagos).values([
      { pedido_id: a.id, monto: "20.00", fecha: enSeptiembre },
      { pedido_id: a.id, monto: "10.00", fecha: enSeptiembre },
      { pedido_id: b.id, monto: "50.00", fecha: enSeptiembre },
    ])

    expect(await consolidacionMensual(2026, 9)).toEqual({
      total_pagos: 80,
      cantidad_pagos: 3,
      total_pedidos: 100,
      cantidad_pedidos: 2,
    })
  })

  test("sin cobros en el mes: todo en cero", async () => {
    await pedidoPorCobrar(50)
    expect(await consolidacionMensual(2026, 9)).toEqual({
      total_pagos: 0,
      cantidad_pagos: 0,
      total_pedidos: 0,
      cantidad_pedidos: 0,
    })
  })
})
