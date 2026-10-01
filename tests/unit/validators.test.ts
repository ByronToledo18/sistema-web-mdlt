import { describe, expect, test } from "vitest"
import { agregarItemBody, crearPedidoCatalogoBody } from "@/server/validators/pedidos"

const cliente = { nombre: "Ana", cedula: "0912345678", telefono: "0991234567", direccion: "Calle 1" }

function primerError(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, value: unknown) {
  const result = schema.safeParse(value)
  return result.success ? null : result.error!.issues[0].message
}

describe("crearPedidoCatalogoBody", () => {
  const base = { cliente, items: [{ id: 1, tipo: "producto", cantidad: 1 }], metodoEntrega: "retiro" }

  test("descarta precio y total que mande el navegador", () => {
    const parsed = crearPedidoCatalogoBody.parse({
      ...base,
      items: [{ id: 1, tipo: "producto", cantidad: 1, precio: 0.01 }],
      total: 0.01,
    })
    expect(parsed.items[0]).toEqual({ id: 1, tipo: "producto", cantidad: 1 })
    expect(parsed).not.toHaveProperty("total")
  })

  test.each([
    [{ ...base, items: [] }, "El pedido debe tener al menos un ítem"],
    [{ ...base, items: [{ id: 1, tipo: "producto", cantidad: 1.5 }] }, "La cantidad de un producto debe ser un número entero"],
    [{ ...base, items: [{ id: 1, tipo: "producto", cantidad: 0 }] }, "Ítem de pedido inválido"],
    [{ ...base, cliente: { ...cliente, cedula: "  " } }, "Nombre, cédula y teléfono son requeridos"],
    [{ ...base, metodoEntrega: "envio" }, "La ciudad de envío es requerida"],
    [{ ...base, metodoEntrega: "envio", cliente: { ...cliente, direccion: "" } }, "La dirección es requerida para envío a domicilio"],
  ])("rechaza %#", (body, mensaje) => {
    expect(primerError(crearPedidoCatalogoBody, body)).toBe(mensaje)
  })
})

describe("agregarItemBody", () => {
  test("acepta números como string (formularios)", () => {
    expect(
      agregarItemBody.parse({ item_tipo: "producto", item_id: "3", cantidad: "2", precio_unitario: "10.5" }),
    ).toMatchObject({ item_id: 3, cantidad: 2, precio_unitario: 10.5, descripcion: null })
  })

  test("rechaza cantidad no entera y precio negativo", () => {
    expect(primerError(agregarItemBody, { item_tipo: "producto", item_id: 3, cantidad: 1.5, precio_unitario: 1 })).toBe(
      "La cantidad debe ser un número entero mayor a 0",
    )
    expect(primerError(agregarItemBody, { item_tipo: "producto", item_id: 3, cantidad: 1, precio_unitario: -1 })).toBe(
      "El precio no puede ser negativo",
    )
  })
})
