import { beforeEach, describe, expect, test } from "vitest"
import { movimientosPorRango, registrarMovimiento } from "@/server/services/nomina"
import { resetDb } from "../support/db-client"

beforeEach(resetDb)

function mov(fecha: string, persona_tipo = "costurera_externa", tipo: "pago" | "bono" | "deduccion" = "pago") {
  return registrarMovimiento({ persona_tipo, concepto: `Mov ${fecha}`, fecha, tipo, monto: 10, pedido_id: null })
}

describe("movimientosPorRango", () => {
  test("incluye ambos extremos y ordena por fecha", async () => {
    await mov("2026-09-30")
    await mov("2026-08-31")
    await mov("2026-09-01")
    await mov("2026-10-01")

    const filas = await movimientosPorRango("2026-09-01", "2026-09-30")
    expect(filas.map((f) => f.fecha)).toEqual(["2026-09-01", "2026-09-30"])
  })

  test("filtra por persona y no tiene el límite de 100 del listado", async () => {
    for (let i = 0; i < 105; i++) await mov("2026-09-15")
    await mov("2026-09-15", "madre")

    expect(await movimientosPorRango("2026-09-01", "2026-09-30", "costurera_externa")).toHaveLength(105)
    expect(await movimientosPorRango("2026-09-01", "2026-09-30", "madre")).toHaveLength(1)
  })
})
