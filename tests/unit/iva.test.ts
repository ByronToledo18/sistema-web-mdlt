import { describe, expect, test } from "vitest"
import { desgloseIva, IVA_PORCENTAJE, IVA_RATE, ivaCents } from "@/lib/iva"
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

  test("el desglose suma el IVA de cada línea (no el de la suma)", () => {
    // Tres líneas de 0,10: 1,5 centavos c/u → 2 por línea = 6 (no 4,5 → 5).
    const lineas = Array.from({ length: 3 }, () => ({ subtotalCents: 10, grabaIva: true }))
    expect(desgloseIva([...lineas, { subtotalCents: 500, grabaIva: false }])).toEqual({
      subtotalGravado: 30,
      subtotal0: 500,
      subtotal: 530,
      iva: 6,
      total: 536,
    })
  })

  test("el carrito asume que grava IVA si el ítem guardado no trae el flag", () => {
    const d = desgloseCarrito(
      [
        { id: 1, tipo: "producto", nombre: "A", precio: 10.5, cantidad: 2 },
        { id: 2, tipo: "servicio", nombre: "B", precio: 5, cantidad: 1, graba_iva: false },
      ],
      { costo: 4, grabaIva: true },
    )
    expect(d).toEqual({ subtotalGravado: 2_500, subtotal0: 500, subtotal: 3_000, iva: 375, total: 3_375 })
  })
})
