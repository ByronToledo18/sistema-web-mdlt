import "server-only"

import { and, asc, count, desc, eq, getTableColumns, ilike, isNotNull, ne, or, sql } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import { db, withTx } from "@/server/db/client"
import { productos, proveedores, proveedorFacturaItems, proveedorFacturas, proveedorPagos } from "@/server/db/schema"
import type { CrearFacturaProveedor, DatosProveedor, PagoFacturaProveedor } from "@/server/validators/proveedores"
import { fromCents, pgErrorCode, PG_UNIQUE_VIOLATION, toCents } from "./_shared"

const IVA_RATE = 0.15

// --- Proveedores --------------------------------------------------------------------

export async function listarProveedores(filtros: { search?: string; mostrarInactivos: boolean }) {
  const patron = `%${filtros.search ?? ""}%`
  return db
    .select()
    .from(proveedores)
    .where(
      and(
        filtros.search
          ? or(ilike(proveedores.nombre, patron), ilike(proveedores.ruc, patron), ilike(proveedores.email, patron))
          : undefined,
        filtros.mostrarInactivos ? undefined : eq(proveedores.activo, true),
      ),
    )
    .orderBy(asc(proveedores.nombre))
}

export async function obtenerProveedor(id: number) {
  const [proveedor] = await db.select().from(proveedores).where(eq(proveedores.id, id))
  if (!proveedor) throw new HttpError(404, "Proveedor no encontrado")
  return proveedor
}

async function assertRucLibre(ruc: string | null, exceptoId?: number) {
  if (!ruc) return
  const [existente] = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(and(eq(proveedores.ruc, ruc), exceptoId ? ne(proveedores.id, exceptoId) : undefined))
  if (existente) throw new HttpError(400, "El RUC ya está registrado")
}

function rucDuplicado(error: unknown): never {
  if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) throw new HttpError(400, "El RUC ya está registrado")
  throw error
}

export async function crearProveedor(datos: DatosProveedor) {
  await assertRucLibre(datos.ruc)
  const [proveedor] = await db.insert(proveedores).values(datos).returning().catch(rucDuplicado)
  return proveedor
}

export async function actualizarProveedor(id: number, datos: DatosProveedor) {
  await assertRucLibre(datos.ruc, id)
  const [proveedor] = await db
    .update(proveedores)
    .set({ ...datos, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(proveedores.id, id))
    .returning()
    .catch(rucDuplicado)
  if (!proveedor) throw new HttpError(404, "Proveedor no encontrado")
  return proveedor
}

export async function eliminarProveedor(id: number): Promise<void> {
  // proveedor_facturas tiene ON DELETE CASCADE: sin este chequeo se borrarían
  // las facturas del proveedor junto con él.
  const [{ value: facturas }] = await db
    .select({ value: count() })
    .from(proveedorFacturas)
    .where(eq(proveedorFacturas.proveedor_id, id))
  if (facturas > 0) {
    throw new HttpError(400, "No se puede eliminar un proveedor con facturas registradas")
  }

  const eliminados = await db.delete(proveedores).where(eq(proveedores.id, id)).returning({ id: proveedores.id })
  if (eliminados.length === 0) throw new HttpError(404, "Proveedor no encontrado")
}

export async function alternarEstadoProveedor(id: number) {
  const [proveedor] = await db
    .update(proveedores)
    .set({ activo: sql`NOT ${proveedores.activo}`, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(proveedores.id, id))
    .returning()
  if (!proveedor) throw new HttpError(404, "Proveedor no encontrado")
  return proveedor
}

// --- Facturas de compra --------------------------------------------------------------

export async function listarFacturasProveedor(proveedorId: number, estado?: string) {
  return db
    .select({
      ...getTableColumns(proveedorFacturas),
      proveedor_nombre: proveedores.nombre,
      total_pagado_real: sql<string>`COALESCE(SUM(${proveedorPagos.monto}), 0)`,
    })
    .from(proveedorFacturas)
    .innerJoin(proveedores, eq(proveedorFacturas.proveedor_id, proveedores.id))
    .leftJoin(proveedorPagos, eq(proveedorFacturas.id, proveedorPagos.factura_id))
    .where(
      and(
        eq(proveedorFacturas.proveedor_id, proveedorId),
        estado && estado !== "todas" ? eq(proveedorFacturas.estado, estado) : undefined,
      ),
    )
    .groupBy(proveedorFacturas.id, proveedores.nombre)
    .orderBy(desc(proveedorFacturas.fecha_emision))
}

// Registra la factura de compra y suma al stock lo comprado, todo o nada.
export async function crearFacturaProveedor(proveedorId: number, input: CrearFacturaProveedor) {
  try {
    return await withTx(async (tx) => {
      const [proveedor] = await tx
        .select({ id: proveedores.id })
        .from(proveedores)
        .where(eq(proveedores.id, proveedorId))
      if (!proveedor) throw new HttpError(404, "Proveedor no encontrado")

      const [existente] = await tx
        .select({ id: proveedorFacturas.id })
        .from(proveedorFacturas)
        .where(
          and(
            eq(proveedorFacturas.proveedor_id, proveedorId),
            eq(proveedorFacturas.numero_factura, input.numero_factura),
          ),
        )
      if (existente) throw new HttpError(400, "El número de factura ya existe para este proveedor")

      const items = input.items.map((item) => {
        const precio = toCents(item.precio_unitario)
        return { ...item, precio, subtotal: Math.round(precio * item.cantidad) }
      })
      const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0)
      const iva = Math.round(subtotal * IVA_RATE)
      const total = subtotal + iva

      const [factura] = await tx
        .insert(proveedorFacturas)
        .values({
          proveedor_id: proveedorId,
          numero_factura: input.numero_factura,
          fecha_emision: input.fecha_emision,
          fecha_vencimiento: input.fecha_vencimiento,
          subtotal: fromCents(subtotal),
          iva: fromCents(iva),
          total: fromCents(total),
          pagado: "0",
          saldo: fromCents(total),
          notas: input.notas,
        })
        .returning()

      // El stock se suma antes de insertar los ítems: el RETURNING detecta un
      // producto_id inexistente y da un 400 claro, en lugar del error de FK de
      // proveedor_factura_items.
      for (const item of items) {
        if (item.producto_id) {
          const [actualizado] = await tx
            .update(productos)
            .set({ stock: sql`${productos.stock} + ${item.cantidad}`, updated_at: sql`CURRENT_TIMESTAMP` })
            .where(eq(productos.id, item.producto_id))
            .returning({ id: productos.id })
          if (!actualizado) throw new HttpError(400, `Producto #${item.producto_id} no encontrado`)
        }
      }

      await tx.insert(proveedorFacturaItems).values(
        items.map((item) => ({
          factura_id: factura.id,
          producto_id: item.producto_id,
          descripcion: item.descripcion,
          cantidad: String(item.cantidad),
          precio_unitario: fromCents(item.precio),
          subtotal: fromCents(item.subtotal),
        })),
      )

      return factura
    })
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw new HttpError(400, "El número de factura ya existe para este proveedor")
    }
    throw error
  }
}

export async function obtenerFacturaProveedor(facturaId: number) {
  const [factura] = await db
    .select({
      ...getTableColumns(proveedorFacturas),
      proveedor_nombre: proveedores.nombre,
      proveedor_ruc: proveedores.ruc,
    })
    .from(proveedorFacturas)
    .innerJoin(proveedores, eq(proveedorFacturas.proveedor_id, proveedores.id))
    .where(eq(proveedorFacturas.id, facturaId))
  if (!factura) throw new HttpError(404, "Factura no encontrada")

  const [items, pagos] = await Promise.all([
    db
      .select({
        ...getTableColumns(proveedorFacturaItems),
        producto_nombre: productos.nombre,
        producto_sku: productos.sku,
      })
      .from(proveedorFacturaItems)
      .leftJoin(productos, eq(proveedorFacturaItems.producto_id, productos.id))
      .where(eq(proveedorFacturaItems.factura_id, facturaId))
      .orderBy(asc(proveedorFacturaItems.id)),
    db
      .select()
      .from(proveedorPagos)
      .where(eq(proveedorPagos.factura_id, facturaId))
      .orderBy(desc(proveedorPagos.fecha)),
  ])

  return { factura, items, pagos }
}

// Anula la factura y descuenta del stock lo que había sumado. Si ese stock ya
// se vendió, no se anula (el stock quedaría negativo).
export async function anularFacturaProveedor(facturaId: number) {
  return withTx(async (tx) => {
    const [factura] = await tx.select().from(proveedorFacturas).where(eq(proveedorFacturas.id, facturaId)).for("update")
    if (!factura) throw new HttpError(404, "Factura no encontrada")
    if (factura.estado === "anulada") throw new HttpError(400, "La factura ya está anulada")

    const [{ value: pagos }] = await tx
      .select({ value: count() })
      .from(proveedorPagos)
      .where(eq(proveedorPagos.factura_id, facturaId))
    if (pagos > 0) throw new HttpError(400, "No se puede anular una factura con pagos registrados")

    const items = await tx
      .select({ producto_id: proveedorFacturaItems.producto_id, cantidad: proveedorFacturaItems.cantidad })
      .from(proveedorFacturaItems)
      .where(and(eq(proveedorFacturaItems.factura_id, facturaId), isNotNull(proveedorFacturaItems.producto_id)))

    for (const item of items) {
      const cantidad = Math.floor(Number(item.cantidad))
      const [actualizado] = await tx
        .update(productos)
        .set({ stock: sql`${productos.stock} - ${cantidad}`, updated_at: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(productos.id, item.producto_id!), sql`${productos.stock} >= ${cantidad}`))
        .returning({ id: productos.id })
      if (!actualizado) {
        throw new HttpError(
          400,
          "No se puede anular la factura: parte del stock que ingresó ya se vendió o se ajustó a mano",
        )
      }
    }

    const [anulada] = await tx
      .update(proveedorFacturas)
      .set({ estado: "anulada", saldo: "0", updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(proveedorFacturas.id, facturaId))
      .returning()
    return anulada
  })
}

export async function pagarFacturaProveedor(facturaId: number, input: PagoFacturaProveedor) {
  return withTx(async (tx) => {
    const [factura] = await tx.select().from(proveedorFacturas).where(eq(proveedorFacturas.id, facturaId)).for("update")
    if (!factura) throw new HttpError(404, "Factura no encontrada")
    if (factura.estado === "anulada") throw new HttpError(400, "No se puede pagar una factura anulada")

    const monto = toCents(input.monto)
    if (monto > toCents(factura.saldo)) {
      throw new HttpError(400, "El monto excede el saldo pendiente")
    }

    await tx.insert(proveedorPagos).values({
      factura_id: facturaId,
      monto: fromCents(monto),
      metodo: input.metodo,
      referencia: input.referencia,
      observacion: input.observacion,
    })

    const pagado = toCents(factura.pagado) + monto
    const saldo = toCents(factura.total) - pagado
    const [actualizada] = await tx
      .update(proveedorFacturas)
      .set({
        pagado: fromCents(pagado),
        saldo: fromCents(saldo),
        estado: saldo <= 0 ? "pagada" : "pendiente",
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(proveedorFacturas.id, facturaId))
      .returning()
    return actualizada
  })
}
