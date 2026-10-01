import { beforeEach, describe, expect, test } from "vitest"
import { db } from "@/server/db/client"
import { proveedores, proveedorFacturaItems, proveedorFacturas } from "@/server/db/schema"
import {
  anularFacturaProveedor,
  crearFacturaProveedor,
  pagarFacturaProveedor,
} from "@/server/services/proveedores"
import { crearFacturaBody, pagoFacturaBody } from "@/server/validators/proveedores"
import { resetDb } from "../support/db-client"
import { crearProducto, stockDe } from "../support/fixtures"

beforeEach(resetDb)

async function crearProveedor() {
  const [row] = await db.insert(proveedores).values({ nombre: "Telas del Pacífico" }).returning()
  return row
}

function factura(items: { producto_id: number | null; cantidad: number; precio_unitario: number }[], numero = "001-001-1") {
  return crearFacturaBody.parse({
    numero_factura: numero,
    fecha_emision: "2026-09-01",
    items: items.map((i) => ({ descripcion: "Tul", ...i })),
  })
}

const pago = (monto: number) => pagoFacturaBody.parse({ monto })

describe("facturas de proveedores", () => {
  test("la compra suma stock y calcula IVA en centavos", async () => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stock: 5 })

    const f = await crearFacturaProveedor(
      proveedor.id,
      factura([
        { producto_id: producto.id, cantidad: 10, precio_unitario: 3.35 },
        { producto_id: null, cantidad: 1.5, precio_unitario: 2 },
      ]),
    )

    expect([f.subtotal, f.iva, f.total, f.saldo]).toEqual(["36.50", "5.48", "41.98", "41.98"])
    expect(await stockDe(producto.id)).toBe(15)
  })

  function facturaConProductoInexistente(productoId: number) {
    return factura([
      { producto_id: productoId, cantidad: 10, precio_unitario: 1 },
      { producto_id: 999, cantidad: 1, precio_unitario: 1 },
    ])
  }

  test("producto inexistente: rollback completo", async () => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stock: 5 })

    await expect(crearFacturaProveedor(proveedor.id, facturaConProductoInexistente(producto.id))).rejects.toThrow()

    expect(await stockDe(producto.id)).toBe(5)
    expect(await db.select().from(proveedorFacturas)).toHaveLength(0)
    expect(await db.select().from(proveedorFacturaItems)).toHaveLength(0)
  })

  // La FK de proveedor_factura_items no debe adelantarse al chequeo del servicio (sería un 500).
  test("producto inexistente: responde 400, no 500", async () => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto()
    await expect(crearFacturaProveedor(proveedor.id, facturaConProductoInexistente(producto.id))).rejects.toMatchObject(
      { status: 400 },
    )
  })

  test("número de factura repetido para el mismo proveedor: 400", async () => {
    const proveedor = await crearProveedor()
    await crearFacturaProveedor(proveedor.id, factura([{ producto_id: null, cantidad: 1, precio_unitario: 1 }]))
    await expect(
      crearFacturaProveedor(proveedor.id, factura([{ producto_id: null, cantidad: 1, precio_unitario: 1 }])),
    ).rejects.toMatchObject({ status: 400 })
  })

  test("pagos: no supera el saldo y la marca pagada al completarlo", async () => {
    const proveedor = await crearProveedor()
    const f = await crearFacturaProveedor(proveedor.id, factura([{ producto_id: null, cantidad: 1, precio_unitario: 100 }]))

    await expect(pagarFacturaProveedor(f.id, pago(115.01))).rejects.toMatchObject({ status: 400 })
    expect(await pagarFacturaProveedor(f.id, pago(100))).toMatchObject({ estado: "pendiente", saldo: "15.00" })
    expect(await pagarFacturaProveedor(f.id, pago(15))).toMatchObject({ estado: "pagada", saldo: "0.00" })
  })

  test("anular descuenta el stock que sumó, una sola vez", async () => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stock: 0 })
    const f = await crearFacturaProveedor(proveedor.id, factura([{ producto_id: producto.id, cantidad: 4, precio_unitario: 1 }]))

    await anularFacturaProveedor(f.id)
    expect(await stockDe(producto.id)).toBe(0)
    await expect(anularFacturaProveedor(f.id)).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(0)
  })

  test("no anula si el stock comprado ya se vendió", async () => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stock: 0 })
    const f = await crearFacturaProveedor(proveedor.id, factura([{ producto_id: producto.id, cantidad: 4, precio_unitario: 1 }]))
    // Se vendieron 3 de las 4 unidades.
    const { productos } = await import("@/server/db/schema")
    await db.update(productos).set({ stock: 1 })

    await expect(anularFacturaProveedor(f.id)).rejects.toMatchObject({ status: 400 })
    expect(await stockDe(producto.id)).toBe(1)
  })

  test("no anula una factura con pagos", async () => {
    const proveedor = await crearProveedor()
    const f = await crearFacturaProveedor(proveedor.id, factura([{ producto_id: null, cantidad: 1, precio_unitario: 10 }]))
    await pagarFacturaProveedor(f.id, pago(5))
    await expect(anularFacturaProveedor(f.id)).rejects.toMatchObject({ status: 400 })
  })
})
