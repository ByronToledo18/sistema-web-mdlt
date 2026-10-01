import { describe, expect, test } from "vitest"
import { anioNegocio, fechaNegocio, hoyNegocio, inicioDelDia, periodoNegocio, rangoDeDias } from "@/lib/fechas"

describe("lib/fechas: calendario de Ecuador (UTC-5)", () => {
  test("2026-01-01 03:00 UTC todavía es 31/12/2025 en Ecuador", () => {
    const t = new Date("2026-01-01T03:00:00Z")
    expect(fechaNegocio(t)).toEqual({ year: 2025, month: 12, day: 31 })
    expect(anioNegocio(t)).toBe(2025)
    expect(periodoNegocio(t)).toBe("2025-12")
    expect(hoyNegocio(t)).toBe("2025-12-31")
  })

  test("a las 05:00 UTC empieza el día en Ecuador", () => {
    expect(hoyNegocio(new Date("2026-01-01T04:59:59Z"))).toBe("2025-12-31")
    expect(hoyNegocio(new Date("2026-01-01T05:00:00Z"))).toBe("2026-01-01")
  })

  test("borde de mes: 01/10 02:00 UTC es septiembre en Ecuador", () => {
    expect(periodoNegocio(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09")
  })

  test("inicioDelDia y rangoDeDias cubren el día completo de Ecuador", () => {
    expect(inicioDelDia("2026-09-30").toISOString()).toBe("2026-09-30T05:00:00.000Z")
    const { inicio, fin } = rangoDeDias("2026-09-01", "2026-09-30")
    expect(inicio.toISOString()).toBe("2026-09-01T05:00:00.000Z")
    expect(fin.toISOString()).toBe("2026-10-01T05:00:00.000Z")
  })
})
