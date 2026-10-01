import { beforeEach, describe, expect, test } from "vitest"
import { db } from "@/server/db/client"
import { pedidoItems, pedidos } from "@/server/db/schema"
import { pedidosPorEstado, resumenDashboard, ventasPorMes } from "@/server/services/dashboard"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

beforeEach(resetDb)

let seq = 0

// Inserta un pedido con fecha (UTC, como la guarda la app), total y estado.
// Sin líneas, como los pedidos anteriores al IVA por ítem: su neto es el total.
async function pedido(created_at: string, total: string, estado: (typeof pedidos.$inferInsert)["estado"] = "recibido") {
  seq++
  const cliente = await crearCliente()
  const [p] = await db
    .insert(pedidos)
    .values({ codigo: `TEST-${seq}`, cliente_id: cliente.id, total, estado, created_at: new Date(created_at) })
    .returning()
  return p
}

// Agrega líneas (subtotal, graba_iva) a un pedido ya creado.
async function lineas(pedidoId: number, ...items: [string, boolean][]) {
  await db.insert(pedidoItems).values(
    items.map(([subtotal, graba_iva]) => ({
      pedido_id: pedidoId,
      item_tipo: "producto" as const,
      item_id: 1,
      cantidad: "1",
      precio_unitario: subtotal,
      subtotal,
      graba_iva,
    })),
  )
}

// 15 de septiembre de 2026 al mediodía en Ecuador (UTC-5).
const AHORA = new Date("2026-09-15T17:00:00Z")

describe("ventasPorMes", () => {
  test("devuelve los N meses hasta el actual, con 0 en los meses sin pedidos", async () => {
    await pedido("2026-07-10T15:00:00Z", "40.00")

    const ventas = await ventasPorMes(3, AHORA)

    expect(ventas).toEqual([
      { mes: "2026-07", neto: 40, conIva: 40, pedidos: 1 },
      { mes: "2026-08", neto: 0, conIva: 0, pedidos: 0 },
      { mes: "2026-09", neto: 0, conIva: 0, pedidos: 0 },
    ])
  })

  test("suma por mes en la hora de Ecuador, no en UTC", async () => {
    // 31/08 23:30 en Ecuador = 01/09 04:30 UTC: es venta de agosto.
    await pedido("2026-09-01T04:30:00Z", "10.00")
    // 01/09 00:30 en Ecuador = 01/09 05:30 UTC: ya es septiembre.
    await pedido("2026-09-01T05:30:00Z", "25.50")

    const ventas = await ventasPorMes(2, AHORA)

    expect(ventas).toEqual([
      { mes: "2026-08", neto: 10, conIva: 10, pedidos: 1 },
      { mes: "2026-09", neto: 25.5, conIva: 25.5, pedidos: 1 },
    ])
  })

  test("excluye los pedidos anulados", async () => {
    await pedido("2026-09-05T15:00:00Z", "30.00", "entregado")
    await pedido("2026-09-06T15:00:00Z", "99.00", "anulado")

    const [septiembre] = await ventasPorMes(1, AHORA)

    expect(septiembre).toEqual({ mes: "2026-09", neto: 30, conIva: 30, pedidos: 1 })
  })

  test("las ventas son netas (sin IVA) y traen aparte el total con IVA", async () => {
    // Dos líneas gravadas de 10,50 (IVA sobre la base: 3,15) y una exenta de 5.
    const a = await pedido("2026-09-05T15:00:00Z", "29.15", "entregado")
    await lineas(a.id, ["10.50", true], ["10.50", true], ["5.00", false])
    // Pedido antiguo sin líneas gravadas: su neto es el total histórico.
    await pedido("2026-09-06T15:00:00Z", "12.00", "recibido")

    const [septiembre] = await ventasPorMes(1, AHORA)

    expect(septiembre).toEqual({ mes: "2026-09", neto: 38, conIva: 41.15, pedidos: 2 })
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

describe("resumenDashboard: ventas del mes", () => {
  test("suma los pedidos del mes actual sin contar los anulados, igual que ventasPorMes", async () => {
    const ahora = new Date().toISOString()
    const p = await pedido(ahora, "23.00", "en_proceso")
    await lineas(p.id, ["20.00", true])
    await pedido(ahora, "50.00", "anulado")

    const { ventasMes } = await resumenDashboard()
    const [mesActual] = await ventasPorMes(1)

    // Neto sin IVA (20,00) y con IVA (23,00).
    expect(ventasMes).toEqual({ neto: 20, conIva: 23 })
    expect({ neto: mesActual.neto, conIva: mesActual.conIva }).toEqual(ventasMes)
  })
})
