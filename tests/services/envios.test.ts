import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { servientregaCuenta, servientregaDetalle } from "@/server/db/schema"
import { actualizarEnvio, crearEnvio } from "@/server/services/envios"
import { crearPedido } from "@/server/services/pedidos"
import { resetDb } from "../support/db-client"
import { admin, crearCliente, crearServicioEnvio } from "../support/fixtures"

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
