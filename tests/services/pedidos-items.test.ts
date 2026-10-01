import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { pagos, pedidoItems, pedidos } from "@/server/db/schema"
import {
  actualizarEstadoPedido,
  agregarItem,
  crearPedido,
  editarItem,
  eliminarItem,
  eliminarPedido,
  generarFactura,
} from "@/server/services/pedidos"
import { resetDb } from "../support/db-client"
import { admin, asistente, crearCliente, crearProducto, crearServicio, stockDe } from "../support/fixtures"

beforeEach(resetDb)

async function pedidoNuevo() {
  const cliente = await crearCliente()
  return crearPedido(cliente.id)
}

async function totalDe(pedidoId: number) {
  const [p] = await db.select({ total: pedidos.total }).from(pedidos).where(eq(pedidos.id, pedidoId))
  return p.total
}

function itemProducto(productoId: number, cantidad: number, precio = 25) {
  return { item_tipo: "producto" as const, item_id: productoId, descripcion: null, cantidad, precio_unitario: precio }
}

describe("ítems de pedido y stock", () => {
  test("agregar un producto descuenta stock y recalcula el total", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 10 })

    await agregarItem(asistente, pedido.id, itemProducto(producto.id, 3, 12.5))

    expect(await stockDe(producto.id)).toBe(7)
    expect(await totalDe(pedido.id)).toBe("37.50")
  })

  test("agregar más de lo que hay en stock: 400 y nada cambia", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 2 })

    await expect(agregarItem(asistente, pedido.id, itemProducto(producto.id, 3))).rejects.toMatchObject({
      status: 400,
    })
    expect(await stockDe(producto.id)).toBe(2)
    expect(await db.select().from(pedidoItems)).toHaveLength(0)
  })

  test("agregar un servicio inexistente: 404", async () => {
    const pedido = await pedidoNuevo()
    await expect(
      agregarItem(asistente, pedido.id, { ...itemProducto(999, 1), item_tipo: "servicio" }),
    ).rejects.toMatchObject({ status: 404 })
  })

  test("editar la cantidad ajusta el stock por la diferencia", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 10 })
    const item = await agregarItem(asistente, pedido.id, itemProducto(producto.id, 2, 10))

    await editarItem(asistente, pedido.id, item.id, { cantidad: 5 })
    expect(await stockDe(producto.id)).toBe(5)
    expect(await totalDe(pedido.id)).toBe("50.00")

    await editarItem(asistente, pedido.id, item.id, { cantidad: 1 })
    expect(await stockDe(producto.id)).toBe(9)
    expect(await totalDe(pedido.id)).toBe("10.00")
  })

  test("editar por encima del stock disponible: 400 y el ítem queda igual", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 3 })
    const item = await agregarItem(asistente, pedido.id, itemProducto(producto.id, 2))

    await expect(editarItem(asistente, pedido.id, item.id, { cantidad: 4 })).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(1)
    const [actual] = await db.select().from(pedidoItems).where(eq(pedidoItems.id, item.id))
    expect(Number(actual.cantidad)).toBe(2)
  })

  test("eliminar el mismo ítem dos veces devuelve el stock una sola vez", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 10 })
    const item = await agregarItem(asistente, pedido.id, itemProducto(producto.id, 4))

    const resultados = await Promise.allSettled([
      eliminarItem(asistente, pedido.id, item.id),
      eliminarItem(asistente, pedido.id, item.id),
    ])

    expect(resultados.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"])
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
      status: 404,
    })
    expect(await stockDe(producto.id)).toBe(10)
    expect(await totalDe(pedido.id)).toBe("0.00")
  })

  test("pedido terminado: el asistente no lo modifica, el administrador sí", async () => {
    const pedido = await pedidoNuevo()
    const servicio = await crearServicio()
    await db.update(pedidos).set({ estado: "terminado" }).where(eq(pedidos.id, pedido.id))
    const item = {
      item_tipo: "servicio" as const,
      item_id: servicio.id,
      descripcion: null,
      cantidad: 1,
      precio_unitario: 5,
    }

    await expect(agregarItem(asistente, pedido.id, item)).rejects.toMatchObject({ status: 403 })
    await expect(agregarItem(admin, pedido.id, item)).resolves.toMatchObject({ subtotal: "5.00" })
  })
})

describe("eliminarPedido", () => {
  test("devuelve al inventario el stock de sus productos", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 10 })
    await agregarItem(asistente, pedido.id, itemProducto(producto.id, 6))

    await eliminarPedido(pedido.id)

    expect(await stockDe(producto.id)).toBe(10)
    expect(await db.select().from(pedidos)).toHaveLength(0)
    expect(await db.select().from(pedidoItems)).toHaveLength(0)
  })

  test("con cobros registrados: 400 y no toca stock ni ítems", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ stock: 10 })
    await agregarItem(asistente, pedido.id, itemProducto(producto.id, 2))
    await db.insert(pagos).values({ pedido_id: pedido.id, monto: "10.00" })

    await expect(eliminarPedido(pedido.id)).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(8)
    expect(await db.select().from(pedidoItems)).toHaveLength(1)
  })
})

describe("estado y factura", () => {
  test("no se puede terminar un pedido con saldo pendiente", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto()
    await agregarItem(asistente, pedido.id, itemProducto(producto.id, 1, 30))
    await db.insert(pagos).values({ pedido_id: pedido.id, monto: "10.00" })

    await expect(actualizarEstadoPedido(asistente, pedido.id, "terminado")).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("20.00"),
    })

    await db.insert(pagos).values({ pedido_id: pedido.id, monto: "20.00" })
    await expect(actualizarEstadoPedido(asistente, pedido.id, "terminado")).resolves.toMatchObject({ estado: "terminado" })
  })

  test("la factura suma 15 % de IVA y no se genera dos veces", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ graba_iva: true })
    await agregarItem(asistente, pedido.id, itemProducto(producto.id, 2, 50))

    const factura = await generarFactura(admin, pedido.id)
    expect([factura.subtotal, factura.iva, factura.total]).toEqual(["100.00", "15.00", "115.00"])
    expect(factura.numero_factura).toBe(`FACT-${new Date().getFullYear()}-0001`)

    await expect(generarFactura(admin, pedido.id)).rejects.toMatchObject({ status: 400 })
  })

  test("no factura pedidos anulados ni vacíos", async () => {
    const vacio = await pedidoNuevo()
    await expect(generarFactura(admin, vacio.id)).rejects.toMatchObject({ status: 400 })

    const anulado = await pedidoNuevo()
    await db.update(pedidos).set({ estado: "anulado" }).where(eq(pedidos.id, anulado.id))
    await expect(generarFactura(admin, anulado.id)).rejects.toMatchObject({ status: 400 })
  })
})
