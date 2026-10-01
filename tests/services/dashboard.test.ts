import { beforeEach, describe, expect, test } from "vitest"
import { db } from "@/server/db/client"
import { pedidos } from "@/server/db/schema"
import { pedidosPorEstado, ventasPorMes } from "@/server/services/dashboard"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

beforeEach(resetDb)

let seq = 0

// Inserta un pedido con fecha (UTC, como la guarda la app), total y estado.
async function pedido(created_at: string, total: string, estado: (typeof pedidos.$inferInsert)["estado"] = "recibido") {
  seq++
  const cliente = await crearCliente()
  await db
    .insert(pedidos)
    .values({ codigo: `TEST-${seq}`, cliente_id: cliente.id, total, estado, created_at: new Date(created_at) })
}

// 15 de septiembre de 2026 al mediodía en Ecuador (UTC-5).
const AHORA = new Date("2026-09-15T17:00:00Z")

describe("ventasPorMes", () => {
  test("devuelve los N meses hasta el actual, con 0 en los meses sin pedidos", async () => {
    await pedido("2026-07-10T15:00:00Z", "40.00")

    const ventas = await ventasPorMes(3, AHORA)

    expect(ventas).toEqual([
      { mes: "2026-07", total: 40, pedidos: 1 },
      { mes: "2026-08", total: 0, pedidos: 0 },
      { mes: "2026-09", total: 0, pedidos: 0 },
    ])
  })

  test("suma por mes en la hora de Ecuador, no en UTC", async () => {
    // 31/08 23:30 en Ecuador = 01/09 04:30 UTC: es venta de agosto.
    await pedido("2026-09-01T04:30:00Z", "10.00")
    // 01/09 00:30 en Ecuador = 01/09 05:30 UTC: ya es septiembre.
    await pedido("2026-09-01T05:30:00Z", "25.50")

    const ventas = await ventasPorMes(2, AHORA)

    expect(ventas).toEqual([
      { mes: "2026-08", total: 10, pedidos: 1 },
      { mes: "2026-09", total: 25.5, pedidos: 1 },
    ])
  })

  test("excluye los pedidos anulados", async () => {
    await pedido("2026-09-05T15:00:00Z", "30.00", "entregado")
    await pedido("2026-09-06T15:00:00Z", "99.00", "anulado")

    const [septiembre] = await ventasPorMes(1, AHORA)

    expect(septiembre).toEqual({ mes: "2026-09", total: 30, pedidos: 1 })
  })

  test("el mes actual se calcula en Ecuador aunque en UTC ya sea el mes siguiente", async () => {
    // 30/09 22:00 en Ecuador = 01/10 03:00 UTC.
    const ventas = await ventasPorMes(1, new Date("2026-10-01T03:00:00Z"))
    expect(ventas.map((v) => v.mes)).toEqual(["2026-09"])
  })
})

describe("pedidosPorEstado", () => {
  test("devuelve los 5 estados en orden, con 0 los que no tienen pedidos", async () => {
    await pedido("2026-09-01T15:00:00Z", "10.00", "recibido")
    await pedido("2026-09-02T15:00:00Z", "10.00", "recibido")
    await pedido("2026-09-03T15:00:00Z", "10.00", "anulado")

    expect(await pedidosPorEstado()).toEqual([
      { estado: "recibido", cantidad: 2 },
      { estado: "en_proceso", cantidad: 0 },
      { estado: "terminado", cantidad: 0 },
      { estado: "anulado", cantidad: 1 },
      { estado: "entregado", cantidad: 0 },
    ])
  })
})
