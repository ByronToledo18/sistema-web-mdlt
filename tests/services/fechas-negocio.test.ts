import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { disenosPersonalizados, envios, servientregaCuenta } from "@/server/db/schema"
import { contarDisenosDeHoy } from "@/server/services/disenos"
import { actualizarEnvio, crearEnvio } from "@/server/services/envios"
import { agregarItem, crearPedido, generarFactura } from "@/server/services/pedidos"
import { resetDb } from "../support/db-client"
import { admin, crearCliente, crearProducto, crearServicioEnvio } from "../support/fixtures"

// 2026-01-01 03:00 UTC = 31/12/2025 22:00 en Ecuador: todo lo que nace en
// ese instante pertenece a 2025 (y al período 2025-12).
const NOCHEVIEJA_EC = new Date("2026-01-01T03:00:00Z")

beforeEach(async () => {
  await resetDb()
  // Solo Date: PGlite necesita los timers reales.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOCHEVIEJA_EC)
})

afterEach(() => {
  vi.useRealTimers()
})

async function pedidoConItem() {
  const cliente = await crearCliente()
  const pedido = await crearPedido(cliente.id)
  const producto = await crearProducto()
  await agregarItem(admin, pedido.id, {
    item_tipo: "producto",
    item_id: producto.id,
    descripcion: null,
    cantidad: 1,
    precio_unitario: 20,
  })
  return pedido
}

describe("fechas del negocio en la víspera de año nuevo (Ecuador)", () => {
  test("el código del pedido usa el año de Ecuador", async () => {
    const pedido = await pedidoConItem()
    expect(pedido.codigo).toBe("TUTU-2025-0001")
  })

  test("la factura usa el año y el día de Ecuador", async () => {
    const pedido = await pedidoConItem()
    const factura = await generarFactura(admin, pedido.id)
    expect(factura.numero_factura).toBe("FACT-2025-0001")
    expect(factura.fecha_emision).toBe("2025-12-31")
  })

  test("la guía SER y la cuenta Servientrega caen en 2025 / 2025-12", async () => {
    const pedido = await pedidoConItem()
    await crearServicioEnvio()
    const envio = await crearEnvio(admin, { pedido_id: pedido.id, costo: 4 })
    expect(envio.guia).toMatch(/^SER-2025-/)

    await actualizarEnvio(envio.id, { estado: "en_proceso" })
    const cuentas = await db.select({ periodo: servientregaCuenta.periodo }).from(servientregaCuenta)
    expect(cuentas).toEqual([{ periodo: "2025-12" }])
    const [despachado] = await db.select().from(envios).where(eq(envios.id, envio.id))
    expect(despachado.estado).toBe("en_proceso")
  })

  test("el límite diario de diseños cuenta el día de Ecuador, no el de UTC", async () => {
    const cliente = await crearCliente()
    const disenio = (created_at: string) => ({
      cliente_id: cliente.id,
      descripcion: "Tutú rosa con brillos",
      imagen_url: "https://example.test/x.jpg",
      created_at: new Date(created_at),
    })
    await db.insert(disenosPersonalizados).values([
      disenio("2025-12-31T04:00:00Z"), // 30/12 23:00 Ecuador: ayer
      disenio("2025-12-31T05:00:00Z"), // 31/12 00:00 Ecuador: hoy
      disenio("2025-12-31T20:00:00Z"), // 31/12 15:00 Ecuador: hoy
    ])

    expect(await contarDisenosDeHoy(cliente.id)).toBe(2)
    // Con CURRENT_DATE de UTC (01/01) habría contado 0.
  })
})
