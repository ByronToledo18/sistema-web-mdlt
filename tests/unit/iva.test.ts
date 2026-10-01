import { describe, expect, test } from "vitest"
import { calcularTotales, IVA_PORCENTAJE, IVA_RATE, ivaCents, ivaSobreBase } from "@/lib/iva"
import { desgloseCarrito } from "@/lib/cart"

describe("lib/iva", () => {
  test("una sola tarifa del 15 %", () => {
    expect(IVA_PORCENTAJE).toBe(15)
    expect(IVA_RATE).toBe(0.15)
  })

  test("IVA por línea en centavos, redondeado", () => {
    expect(ivaCents(10_000, true)).toBe(1_500)
    expect(ivaCents(1_050, true)).toBe(158) // 157,5 → 158
    expect(ivaCents(333, true)).toBe(50) // 49,95 → 50
    expect(ivaCents(10_000, false)).toBe(0)
  })

  test("IVA sobre una base: half-up a centavos", () => {
    expect(ivaSobreBase(2_100)).toBe(315)
    expect(ivaSobreBase(30)).toBe(5) // 4,5 → 5
    expect(ivaSobreBase(0)).toBe(0)
  })

  test("calcularTotales aplica el IVA sobre la base gravada (no suma el de cada línea)", () => {
    // Tres líneas de 0,10: por línea serían 2 centavos c/u = 6; sobre la base
    // 0,30 × 15 % = 4,5 → 5.
    const lineas = Array.from({ length: 3 }, () => ({ subtotalCents: 10, grabaIva: true }))
    expect(calcularTotales([...lineas, { subtotalCents: 500, grabaIva: false }])).toEqual({
      subtotal: 530,
      subtotal0: 500,
      baseGravada: 30,
      iva: 5,
      total: 535,
    })
    // Dos líneas de 10,50: por línea 1,58 + 1,58 = 3,16; sobre la base 3,15.
    const dos = Array.from({ length: 2 }, () => ({ subtotalCents: 1_050, grabaIva: true }))
    expect(dos.reduce((acc, l) => acc + ivaCents(l.subtotalCents, l.grabaIva), 0)).toBe(316)
    expect(calcularTotales(dos)).toMatchObject({ baseGravada: 2_100, iva: 315, total: 2_415 })
  })

  test("sin líneas gravadas (pedidos anteriores al IVA por ítem) el IVA es cero", () => {
    expect(calcularTotales([{ subtotalCents: 2_500, grabaIva: false }])).toEqual({
      subtotal: 2_500,
      subtotal0: 2_500,
      baseGravada: 0,
      iva: 0,
      total: 2_500,
    })
    expect(calcularTotales([])).toEqual({ subtotal: 0, subtotal0: 0, baseGravada: 0, iva: 0, total: 0 })
  })

  test("el carrito asume que grava IVA si el ítem guardado no trae el flag", () => {
    const d = desgloseCarrito(
      [
        { id: 1, tipo: "producto", nombre: "A", precio: 10.5, cantidad: 2 },
        { id: 2, tipo: "servicio", nombre: "B", precio: 5, cantidad: 1, graba_iva: false },
      ],
      { costo: 4, grabaIva: true },
    )
    expect(d).toEqual({ subtotal: 3_000, subtotal0: 500, baseGravada: 2_500, iva: 375, total: 3_375 })
  })
})
