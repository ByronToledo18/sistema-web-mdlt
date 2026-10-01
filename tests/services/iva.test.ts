import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { pedidoItems, pedidos, productos, servicios } from "@/server/db/schema"
import { registrarPago } from "@/server/services/pagos"
import { recalcularTotalPedido } from "@/server/services/pedido-base"
import {
  actualizarEstadoPedido,
  agregarItem,
  crearPedido,
  crearPedidoDesdeCatalogo,
  editarItem,
  generarFactura,
} from "@/server/services/pedidos"
import { crearPedidoCatalogoBody } from "@/server/validators/pedidos"
import { resetDb } from "../support/db-client"
import {
  admin,
  asistente,
  crearCliente,
  crearProducto,
  crearServicio,
  crearServicioEnvio,
  crearTarifa,
} from "../support/fixtures"

// IVA por ítem: los precios del catálogo no incluyen IVA; pedidos.total suma
// el IVA de las líneas que lo gravan y es lo que se cobra y se factura.

beforeEach(resetDb)

async function pedidoNuevo() {
  const cliente = await crearCliente()
  return crearPedido(cliente.id)
}

async function totalDe(pedidoId: number) {
  const [p] = await db.select({ total: pedidos.total }).from(pedidos).where(eq(pedidos.id, pedidoId))
  return p.total
}

function item(tipo: "producto" | "servicio", id: number, cantidad: number, precio: number) {
  return { item_tipo: tipo, item_id: id, descripcion: null, cantidad, precio_unitario: precio }
}

function pago(pedidoId: number, monto: number) {
  return { pedido_id: pedidoId, monto, metodo: "efectivo", referencia: null, observacion: null }
}

describe("líneas de pedido", () => {
  test("un producto que grava IVA suma el 15 % al total", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ graba_iva: true })

    const linea = await agregarItem(asistente, pedido.id, item("producto", producto.id, 2, 50))

    expect([linea.subtotal, linea.graba_iva, linea.iva]).toEqual(["100.00", true, "15.00"])
    expect(await totalDe(pedido.id)).toBe("115.00")
  })

  test("mezcla gravados y no gravados, con el IVA redondeado por línea", async () => {
    const pedido = await pedidoNuevo()
    const gravado = await crearProducto({ graba_iva: true })
    const exento = await crearServicio({ graba_iva: false })

    // 10,50 × 15 % = 1,575 → 1,58 (redondeo por línea, en centavos).
    const a = await agregarItem(asistente, pedido.id, item("producto", gravado.id, 1, 10.5))
    const b = await agregarItem(asistente, pedido.id, item("servicio", exento.id, 3, 3.33))

    expect(a.iva).toBe("1.58")
    expect([b.subtotal, b.graba_iva, b.iva]).toEqual(["9.99", false, "0.00"])
    expect(await totalDe(pedido.id)).toBe("22.07") // 10,50 + 1,58 + 9,99
  })

  test("cambiar el flag del producto después no altera las líneas existentes", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ graba_iva: true })
    const linea = await agregarItem(asistente, pedido.id, item("producto", producto.id, 1, 20))
    expect(await totalDe(pedido.id)).toBe("23.00")

    await db.update(productos).set({ graba_iva: false }).where(eq(productos.id, producto.id))
    // Editar la cantidad recalcula con el graba_iva copiado en la línea.
    const editada = await editarItem(asistente, pedido.id, linea.id, { cantidad: 2 })

    expect([editada.subtotal, editada.graba_iva, editada.iva]).toEqual(["40.00", true, "6.00"])
    expect(await totalDe(pedido.id)).toBe("46.00")

    // Una línea nueva sí toma el flag actual.
    const nueva = await agregarItem(asistente, pedido.id, item("producto", producto.id, 1, 20))
    expect([nueva.graba_iva, nueva.iva]).toEqual([false, "0.00"])
    expect(await totalDe(pedido.id)).toBe("66.00")
  })

  test("las líneas anteriores a la migración (sin IVA) conservan el total histórico", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto()
    // Así quedan las filas viejas: graba_iva/iva toman el default de la columna.
    await db.insert(pedidoItems).values({
      pedido_id: pedido.id,
      item_tipo: "producto",
      item_id: producto.id,
      cantidad: "2",
      precio_unitario: "12.50",
      subtotal: "25.00",
    })
    await recalcularTotalPedido(db, pedido.id)

    const [linea] = await db.select().from(pedidoItems).where(eq(pedidoItems.pedido_id, pedido.id))
    expect([linea.graba_iva, linea.iva]).toEqual([false, "0.00"])
    expect(await totalDe(pedido.id)).toBe("25.00")
  })
})

describe("cobros y cierre con IVA", () => {
  test("el cobro del total con IVA deja saldo cero y permite cerrar; no se puede cobrar de más", async () => {
    const pedido = await pedidoNuevo()
    const producto = await crearProducto({ graba_iva: true })
    await agregarItem(asistente, pedido.id, item("producto", producto.id, 1, 40))
    expect(await totalDe(pedido.id)).toBe("46.00")

    await expect(registrarPago(asistente, pago(pedido.id, 46.01))).rejects.toMatchObject({ status: 400 })
    await registrarPago(asistente, pago(pedido.id, 40))
    await expect(actualizarEstadoPedido(asistente, pedido.id, "terminado")).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("6.00"),
    })

    await registrarPago(asistente, pago(pedido.id, 6))
    await expect(actualizarEstadoPedido(asistente, pedido.id, "terminado")).resolves.toMatchObject({
      estado: "terminado",
    })
  })
})

describe("factura", () => {
  test("desglosa subtotal 15 %, subtotal 0 % e IVA, y su total es pedidos.total", async () => {
    const pedido = await pedidoNuevo()
    const gravado = await crearProducto({ graba_iva: true })
    const exento = await crearServicio({ graba_iva: false })
    await agregarItem(asistente, pedido.id, item("producto", gravado.id, 2, 10.5))
    await agregarItem(asistente, pedido.id, item("servicio", exento.id, 1, 5))

    const factura = await generarFactura(admin, pedido.id)

    // Subtotal 15 % = 21,00; Subtotal 0 % = 5,00; IVA = 3,15.
    expect([factura.subtotal, factura.subtotal_0, factura.iva, factura.total]).toEqual([
      "26.00",
      "5.00",
      "3.15",
      "29.15",
    ])
    expect(factura.total).toBe(await totalDe(pedido.id))
  })
})

describe("checkout del catálogo", () => {
  function checkout(body: Record<string, unknown>) {
    return crearPedidoCatalogoBody.parse({
      cliente: { nombre: "Ana Pérez", cedula: "0912345678", telefono: "0991234567", direccion: "Av. 9 de Octubre" },
      metodoEntrega: "retiro",
      ...body,
    })
  }

  test("el servidor suma el IVA de cada ítem según su flag", async () => {
    const cliente = await crearCliente()
    const gravado = await crearProducto({ precio: "25.50", graba_iva: true })
    const exento = await crearServicio({ precio_base: "10.00", graba_iva: false })

    const pedido = await crearPedidoDesdeCatalogo(
      cliente.id,
      checkout({
        items: [
          { id: gravado.id, tipo: "producto", cantidad: 2 },
          { id: exento.id, tipo: "servicio", cantidad: 1 },
        ],
      }),
    )

    // 51,00 + 7,65 de IVA + 10,00 sin IVA.
    expect(pedido.total).toBe("68.65")
    const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedido_id, pedido.id))
    expect(items.map((i) => [i.subtotal, i.graba_iva, i.iva])).toEqual([
      ["51.00", true, "7.65"],
      ["10.00", false, "0.00"],
    ])
  })

  test.each([
    [true, "5.50", "0.83", "29.33"],
    [false, "5.50", "0.00", "28.50"],
  ])("el envío respeta el flag de su servicio (graba_iva = %s)", async (grabaIva, subtotal, iva, total) => {
    const cliente = await crearCliente()
    const producto = await crearProducto({ precio: "20.00", graba_iva: true })
    const envio = await crearServicioEnvio()
    await db.update(servicios).set({ graba_iva: grabaIva }).where(eq(servicios.id, envio.id))
    await crearTarifa("Quito", "5.50")

    const pedido = await crearPedidoDesdeCatalogo(
      cliente.id,
      checkout({ items: [{ id: producto.id, tipo: "producto", cantidad: 1 }], metodoEntrega: "envio", ciudadEnvio: "Quito" }),
    )

    // Producto: 20,00 + 3,00 de IVA.
    expect(pedido.total).toBe(total)
    const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedido_id, pedido.id))
    const lineaEnvio = items.find((i) => i.item_id === envio.id && i.item_tipo === "servicio")
    expect([lineaEnvio?.subtotal, lineaEnvio?.graba_iva, lineaEnvio?.iva]).toEqual([subtotal, grabaIva, iva])
  })
})
