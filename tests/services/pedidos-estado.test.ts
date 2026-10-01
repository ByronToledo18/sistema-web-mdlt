import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { envios, pagos, pedidos, productos } from "@/server/db/schema"
import {
  actualizarEstadoPedido,
  agregarItem,
  crearPedido,
  editarItem,
  eliminarItem,
  eliminarPedido,
} from "@/server/services/pedidos"
import { crearEnvio } from "@/server/services/envios"
import { eliminarPago, registrarPago } from "@/server/services/pagos"
import { resetDb } from "../support/db-client"
import { admin, asistente, crearCliente, crearProducto, crearServicioEnvio, stockDe } from "../support/fixtures"

beforeEach(resetDb)

// Pedido con `cantidad` unidades de un producto de $10 (stock inicial 10).
async function pedidoConProducto(cantidad = 3) {
  const cliente = await crearCliente()
  const pedido = await crearPedido(cliente.id)
  const producto = await crearProducto({ stock: 10, precio: "10.00" })
  const item = await agregarItem(admin, pedido.id, {
    item_tipo: "producto",
    item_id: producto.id,
    descripcion: null,
    cantidad,
    precio_unitario: 10,
  })
  return { pedido, producto, item, total: cantidad * 10 }
}

async function estadoDe(pedidoId: number) {
  const [p] = await db.select({ estado: pedidos.estado }).from(pedidos).where(eq(pedidos.id, pedidoId))
  return p.estado
}

async function pagarTodo(pedidoId: number, total: number) {
  await db.insert(pagos).values({ pedido_id: pedidoId, monto: total.toFixed(2) })
}

describe("transiciones de estado", () => {
  test("recibido → en_proceso → terminado → entregado (con saldo cero)", async () => {
    const { pedido, total } = await pedidoConProducto()
    await pagarTodo(pedido.id, total)

    for (const estado of ["en_proceso", "terminado", "entregado"] as const) {
      await expect(actualizarEstadoPedido(asistente, pedido.id, estado)).resolves.toMatchObject({ estado })
    }
  })

  test("el mismo estado no cambia nada (ni stock)", async () => {
    const { pedido, producto } = await pedidoConProducto(3)
    await actualizarEstadoPedido(admin, pedido.id, "anulado")
    await actualizarEstadoPedido(admin, pedido.id, "anulado")
    expect(await stockDe(producto.id)).toBe(10)
  })

  test("pedido inexistente: 404", async () => {
    await expect(actualizarEstadoPedido(admin, 999, "en_proceso")).rejects.toMatchObject({ status: 404 })
  })

  test("el asistente puede anular un pedido abierto y el stock vuelve", async () => {
    const { pedido, producto } = await pedidoConProducto(4)
    await expect(actualizarEstadoPedido(asistente, pedido.id, "anulado")).resolves.toMatchObject({ estado: "anulado" })
    expect(await stockDe(producto.id)).toBe(10)
  })

  test("el asistente puede volver de en_proceso a recibido (pedido abierto)", async () => {
    const { pedido } = await pedidoConProducto()
    await actualizarEstadoPedido(asistente, pedido.id, "en_proceso")
    await expect(actualizarEstadoPedido(asistente, pedido.id, "recibido")).resolves.toMatchObject({ estado: "recibido" })
  })

  test("entregado → terminado tampoco lo hace el asistente", async () => {
    const { pedido, total } = await pedidoConProducto()
    await pagarTodo(pedido.id, total)
    await actualizarEstadoPedido(asistente, pedido.id, "entregado")
    await expect(actualizarEstadoPedido(asistente, pedido.id, "terminado")).rejects.toMatchObject({ status: 403 })
  })

  test("el administrador anula un pedido terminado y el stock vuelve", async () => {
    const { pedido, producto, total } = await pedidoConProducto(2)
    await pagarTodo(pedido.id, total)
    await actualizarEstadoPedido(asistente, pedido.id, "terminado")
    await actualizarEstadoPedido(admin, pedido.id, "anulado")
    expect(await stockDe(producto.id)).toBe(10)
    expect(await estadoDe(pedido.id)).toBe("anulado")
  })
})

describe("pedidos cerrados: solo el administrador los reabre", () => {
  test.each(["terminado", "anulado", "entregado"] as const)("asistente no puede sacar un pedido de %s", async (cerrado) => {
    const { pedido, total } = await pedidoConProducto()
    await pagarTodo(pedido.id, total)
    await db.update(pedidos).set({ estado: cerrado }).where(eq(pedidos.id, pedido.id))

    await expect(actualizarEstadoPedido(asistente, pedido.id, "en_proceso")).rejects.toMatchObject({ status: 403 })
    expect(await estadoDe(pedido.id)).toBe(cerrado)
  })

  test("el administrador sí reabre un pedido terminado", async () => {
    const { pedido, total } = await pedidoConProducto()
    await pagarTodo(pedido.id, total)
    await actualizarEstadoPedido(asistente, pedido.id, "terminado")

    await expect(actualizarEstadoPedido(admin, pedido.id, "en_proceso")).resolves.toMatchObject({
      estado: "en_proceso",
    })
  })

  test("entregado también bloquea los ítems", async () => {
    const { pedido, item, total } = await pedidoConProducto()
    await pagarTodo(pedido.id, total)
    await actualizarEstadoPedido(asistente, pedido.id, "entregado")

    await expect(editarItem(asistente, pedido.id, item.id, { cantidad: 1 })).rejects.toMatchObject({ status: 400 })
  })
})

// Un pedido cerrado tiene saldo cero, y nada (ni el administrador) puede
// dejarlo cerrado con saldo pendiente: ni ítems ni cobros eliminados. Para
// corregirlo hay que reabrirlo.
describe("pedidos cerrados: el saldo sigue en cero", () => {
  async function saldoDe(pedidoId: number) {
    const [p] = await db.select({ total: pedidos.total }).from(pedidos).where(eq(pedidos.id, pedidoId))
    const cobros = await db.select({ monto: pagos.monto }).from(pagos).where(eq(pagos.pedido_id, pedidoId))
    return Math.round(Number(p.total) * 100) - cobros.reduce((acc, c) => acc + Math.round(Number(c.monto) * 100), 0)
  }

  async function pedidoCerrado(estado: "terminado" | "entregado") {
    const datos = await pedidoConProducto(3)
    const pago = await registrarPago(asistente, {
      pedido_id: datos.pedido.id,
      monto: datos.total,
      metodo: "efectivo",
      referencia: null,
      observacion: null,
    })
    await actualizarEstadoPedido(asistente, datos.pedido.id, estado)
    return { ...datos, pago }
  }

  test.each(["terminado", "entregado"] as const)(
    "%s: el administrador no edita, agrega ni elimina ítems, ni elimina cobros",
    async (estado) => {
      const { pedido, producto, item, pago } = await pedidoCerrado(estado)
      const nuevo = { item_tipo: "producto" as const, item_id: producto.id, descripcion: null, cantidad: 1, precio_unitario: 10 }

      await expect(editarItem(admin, pedido.id, item.id, { cantidad: 5 })).rejects.toMatchObject({ status: 400 })
      await expect(agregarItem(admin, pedido.id, nuevo)).rejects.toMatchObject({ status: 400 })
      await expect(eliminarItem(admin, pedido.id, item.id)).rejects.toMatchObject({ status: 400 })
      await expect(crearEnvio(admin, { pedido_id: pedido.id, costo: 3 })).rejects.toMatchObject({ status: 400 })
      await expect(eliminarPago(pago.id)).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("reábrelo"),
      })

      expect(await saldoDe(pedido.id)).toBe(0)
      expect(await estadoDe(pedido.id)).toBe(estado)
      expect(await stockDe(producto.id)).toBe(7)
      expect(await db.select().from(pagos).where(eq(pagos.pedido_id, pedido.id))).toHaveLength(1)
    },
  )

  test("anulado: tampoco se eliminan sus cobros", async () => {
    const { pedido } = await pedidoConProducto(1)
    const pago = await registrarPago(asistente, {
      pedido_id: pedido.id,
      monto: 5,
      metodo: "efectivo",
      referencia: null,
      observacion: null,
    })
    await actualizarEstadoPedido(asistente, pedido.id, "anulado")
    await expect(eliminarPago(pago.id)).rejects.toMatchObject({ status: 400 })
  })

  test("reabierto por el administrador, ya se corrige; para volver a cerrarlo exige saldo cero", async () => {
    const { pedido, item, pago } = await pedidoCerrado("terminado")
    await actualizarEstadoPedido(admin, pedido.id, "en_proceso")

    await eliminarPago(pago.id)
    await editarItem(admin, pedido.id, item.id, { cantidad: 2 })
    expect(await saldoDe(pedido.id)).toBe(2_000)
    await expect(actualizarEstadoPedido(admin, pedido.id, "terminado")).rejects.toMatchObject({ status: 400 })
    expect(await estadoDe(pedido.id)).toBe("en_proceso")
  })

  test("eliminarPago de un pedido abierto sigue funcionando; inexistente: 404", async () => {
    const { pedido } = await pedidoConProducto(1)
    const pago = await registrarPago(asistente, {
      pedido_id: pedido.id,
      monto: 5,
      metodo: "efectivo",
      referencia: null,
      observacion: null,
    })
    await eliminarPago(pago.id)
    expect(await db.select().from(pagos)).toHaveLength(0)
    await expect(eliminarPago(pago.id)).rejects.toMatchObject({ status: 404 })
  })
})

describe("anular y reabrir: stock", () => {
  test("anular devuelve el stock de los productos", async () => {
    const { pedido, producto } = await pedidoConProducto(3)
    expect(await stockDe(producto.id)).toBe(7)

    await actualizarEstadoPedido(asistente, pedido.id, "anulado")
    expect(await stockDe(producto.id)).toBe(10)
  })

  test("reabrir un anulado vuelve a descontar el stock", async () => {
    const { pedido, producto } = await pedidoConProducto(3)
    await actualizarEstadoPedido(asistente, pedido.id, "anulado")

    await actualizarEstadoPedido(admin, pedido.id, "en_proceso")
    expect(await stockDe(producto.id)).toBe(7)
  })

  test("reabrir sin stock suficiente: 400 y sigue anulado con el stock intacto", async () => {
    const { pedido, producto } = await pedidoConProducto(3)
    await actualizarEstadoPedido(asistente, pedido.id, "anulado")
    // Mientras estaba anulado se vendió casi todo.
    await db.update(productos).set({ stock: 2 }).where(eq(productos.id, producto.id))

    await expect(actualizarEstadoPedido(admin, pedido.id, "recibido")).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Stock insuficiente"),
    })
    expect(await estadoDe(pedido.id)).toBe("anulado")
    expect(await stockDe(producto.id)).toBe(2)
  })

  test("los ítems de un pedido anulado no se tocan, ni siquiera el administrador", async () => {
    const { pedido, producto, item } = await pedidoConProducto(3)
    await actualizarEstadoPedido(admin, pedido.id, "anulado")

    await expect(editarItem(admin, pedido.id, item.id, { cantidad: 5 })).rejects.toMatchObject({ status: 400 })
    await expect(eliminarItem(admin, pedido.id, item.id)).rejects.toMatchObject({ status: 400 })
    await expect(
      agregarItem(admin, pedido.id, {
        item_tipo: "producto",
        item_id: producto.id,
        descripcion: null,
        cantidad: 1,
        precio_unitario: 10,
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(10)
  })

  test("eliminar un pedido anulado no devuelve el stock dos veces", async () => {
    const { pedido, producto } = await pedidoConProducto(3)
    await actualizarEstadoPedido(admin, pedido.id, "anulado")

    await eliminarPedido(pedido.id)
    expect(await stockDe(producto.id)).toBe(10)
  })
})

describe("saldo cero para cerrar", () => {
  test.each([
    ["terminado", "completar"],
    ["entregado", "entregar"],
  ] as const)("%s con saldo pendiente: 400", async (estado, verbo) => {
    const { pedido } = await pedidoConProducto(3)
    await db.insert(pagos).values({ pedido_id: pedido.id, monto: "10.00" })

    await expect(actualizarEstadoPedido(admin, pedido.id, estado)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(new RegExp(`${verbo}.*20\\.00`)),
    })
    expect(await estadoDe(pedido.id)).toBe("recibido")
  })

  test("entregar con ciudad de envío crea el envío pendiente una sola vez", async () => {
    const { pedido, total } = await pedidoConProducto(1)
    const servicio = await crearServicioEnvio()
    await agregarItem(admin, pedido.id, {
      item_tipo: "servicio",
      item_id: servicio.id,
      descripcion: "Envío",
      cantidad: 1,
      precio_unitario: 5,
    })
    await db.update(pedidos).set({ ciudad_envio: "Quito" }).where(eq(pedidos.id, pedido.id))
    await pagarTodo(pedido.id, total + 5)

    await actualizarEstadoPedido(admin, pedido.id, "terminado")
    await actualizarEstadoPedido(admin, pedido.id, "entregado")
    expect(await db.select().from(envios).where(eq(envios.pedido_id, pedido.id))).toHaveLength(1)
  })
})
