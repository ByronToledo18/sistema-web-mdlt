import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import { db } from "@/server/db/client"
import { clientes, pedidoItems, pedidos } from "@/server/db/schema"
import { crearPedidoDesdeCatalogo } from "@/server/services/pedidos"
import { crearPedidoCatalogoBody } from "@/server/validators/pedidos"
import { resetDb } from "../support/db-client"
import { crearCliente, crearProducto, crearServicio, crearServicioEnvio, crearTarifa, stockDe } from "../support/fixtures"

// El body pasa por el mismo esquema Zod que usa la ruta, así se prueba
// también que los campos que manda el navegador (precio, total) se descartan.
function checkout(body: Record<string, unknown>) {
  return crearPedidoCatalogoBody.parse({
    cliente: { nombre: "Ana Pérez", cedula: "0912345678", telefono: "0991234567", direccion: "Av. 9 de Octubre" },
    metodoEntrega: "retiro",
    ...body,
  })
}

const year = new Date().getFullYear()

beforeEach(resetDb)

describe("crearPedidoDesdeCatalogo", () => {
  test("usa el precio de la base y no el que manda el cliente", async () => {
    const cliente = await crearCliente()
    const producto = await crearProducto({ precio: "25.50", stock: 5 })
    const servicio = await crearServicio({ precio_base: "10.00" })

    const pedido = await crearPedidoDesdeCatalogo(
      cliente.id,
      checkout({
        items: [
          { id: producto.id, tipo: "producto", cantidad: 2, precio: 0.01 },
          { id: servicio.id, tipo: "servicio", cantidad: 1, precio: 0 },
        ],
        total: 0.01,
      }),
    )

    expect(pedido.total).toBe("61.00")
    expect(pedido.codigo).toBe(`TUTU-${year}-0001`)
    const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedido_id, pedido.id))
    expect(items.map((i) => [i.descripcion, i.precio_unitario, i.subtotal])).toEqual([
      [producto.nombre, "25.50", "51.00"],
      [servicio.nombre, "10.00", "10.00"],
    ])
    expect(await stockDe(producto.id)).toBe(3)
  })

  test("stock insuficiente: rechaza y no deja nada a medias", async () => {
    const cliente = await crearCliente({ nombre: "Nombre original" })
    const conStock = await crearProducto({ stock: 10 })
    const sinStock = await crearProducto({ stock: 1 })

    const promesa = crearPedidoDesdeCatalogo(
      cliente.id,
      checkout({
        items: [
          { id: conStock.id, tipo: "producto", cantidad: 3 },
          { id: sinStock.id, tipo: "producto", cantidad: 2 },
        ],
      }),
    )

    await expect(promesa).rejects.toThrow(HttpError)
    await expect(promesa).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Stock insuficiente") })
    // Rollback completo: ni el stock del primer producto, ni el pedido, ni los
    // datos del cliente (que se actualizan al principio de la transacción).
    expect(await stockDe(conStock.id)).toBe(10)
    expect(await stockDe(sinStock.id)).toBe(1)
    expect(await db.select().from(pedidos)).toHaveLength(0)
    expect(await db.select().from(pedidoItems)).toHaveLength(0)
    const [c] = await db.select().from(clientes).where(eq(clientes.id, cliente.id))
    expect(c.nombre).toBe("Nombre original")
  })

  test("no vende productos inactivos", async () => {
    const cliente = await crearCliente()
    const producto = await crearProducto({ activo: false })

    await expect(
      crearPedidoDesdeCatalogo(cliente.id, checkout({ items: [{ id: producto.id, tipo: "producto", cantidad: 1 }] })),
    ).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(10)
  })

  test("dos pedidos simultáneos por la última unidad: solo uno se crea", async () => {
    const producto = await crearProducto({ stock: 1 })
    const [c1, c2] = [await crearCliente(), await crearCliente()]
    const body = checkout({ items: [{ id: producto.id, tipo: "producto", cantidad: 1 }] })

    const resultados = await Promise.allSettled([
      crearPedidoDesdeCatalogo(c1.id, body),
      crearPedidoDesdeCatalogo(c2.id, body),
    ])

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const [rechazo] = resultados.filter((r) => r.status === "rejected")
    expect((rechazo as PromiseRejectedResult).reason).toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(0)
    expect(await db.select().from(pedidos)).toHaveLength(1)
  })

  test("envío a domicilio: suma la tarifa de la ciudad como ítem Envío", async () => {
    const cliente = await crearCliente()
    const producto = await crearProducto({ precio: "20.00" })
    const envio = await crearServicioEnvio()
    await crearTarifa("Quito", "5.50")

    const pedido = await crearPedidoDesdeCatalogo(
      cliente.id,
      checkout({
        items: [{ id: producto.id, tipo: "producto", cantidad: 1 }],
        metodoEntrega: "envio",
        ciudadEnvio: "Quito",
        costoEnvio: 0,
      }),
    )

    expect(pedido.total).toBe("25.50")
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, pedido.id))
    expect(p.costo_envio).toBe("5.50")
    expect(p.ciudad_envio).toBe("Quito")
    const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedido_id, pedido.id))
    expect(items.find((i) => i.item_id === envio.id && i.item_tipo === "servicio")?.subtotal).toBe("5.50")
  })

  test("envío a una ciudad sin tarifa: rechaza y devuelve el stock", async () => {
    const cliente = await crearCliente()
    const producto = await crearProducto({ stock: 4 })

    await expect(
      crearPedidoDesdeCatalogo(
        cliente.id,
        checkout({
          items: [{ id: producto.id, tipo: "producto", cantidad: 2 }],
          metodoEntrega: "envio",
          ciudadEnvio: "Ciudad inexistente",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(4)
    expect(await db.select().from(pedidos)).toHaveLength(0)
  })

  test("los códigos de pedido son correlativos", async () => {
    const producto = await crearProducto()
    const cliente = await crearCliente()
    const body = checkout({ items: [{ id: producto.id, tipo: "producto", cantidad: 1 }] })

    const a = await crearPedidoDesdeCatalogo(cliente.id, body)
    const b = await crearPedidoDesdeCatalogo(cliente.id, body)

    expect([a.codigo, b.codigo]).toEqual([`TUTU-${year}-0001`, `TUTU-${year}-0002`])
  })
})
