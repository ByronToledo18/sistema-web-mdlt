import "server-only"

import { and, asc, count, eq, ilike, ne, or, sql } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import { db } from "@/server/db/client"
import { pedidoItems, productos, servicios, tarifasEnvio } from "@/server/db/schema"
import type { DatosProducto, DatosServicio } from "@/server/validators/catalogo"
import { money, pgErrorCode, PG_UNIQUE_VIOLATION } from "./_shared"
import { SERVICIO_ENVIO } from "./envios"

// --- Productos -----------------------------------------------------------------------

export async function listarProductos(filtros: { search?: string; activo?: boolean }) {
  return db
    .select()
    .from(productos)
    .where(
      and(
        filtros.search
          ? or(ilike(productos.nombre, `%${filtros.search}%`), ilike(productos.sku, `%${filtros.search}%`))
          : undefined,
        filtros.activo !== undefined ? eq(productos.activo, filtros.activo) : undefined,
      ),
    )
    .orderBy(asc(productos.nombre))
}

export async function obtenerProducto(id: number) {
  const [producto] = await db.select().from(productos).where(eq(productos.id, id))
  if (!producto) throw new HttpError(404, "Producto no encontrado")
  return producto
}

function skuDuplicado(error: unknown): never {
  if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) throw new HttpError(400, "El SKU ya existe")
  throw error
}

export async function crearProducto(datos: DatosProducto) {
  const [producto] = await db
    .insert(productos)
    .values({ ...datos, precio: money(datos.precio), stock: datos.stock ?? 0 })
    .returning()
    .catch(skuDuplicado)
  return producto
}

export async function actualizarProducto(id: number, datos: DatosProducto) {
  const [producto] = await db
    .update(productos)
    .set({
      ...datos,
      precio: money(datos.precio),
      // Sin stock en el body se conserva el actual (antes se ponía en 0).
      stock: datos.stock ?? undefined,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(productos.id, id))
    .returning()
    .catch(skuDuplicado)
  if (!producto) throw new HttpError(404, "Producto no encontrado")
  return producto
}

async function assertSinUsoEnPedidos(tipo: "producto" | "servicio", id: number) {
  const [{ value: usos }] = await db
    .select({ value: count() })
    .from(pedidoItems)
    .where(and(eq(pedidoItems.item_tipo, tipo), eq(pedidoItems.item_id, id)))
  if (usos > 0) {
    throw new HttpError(
      400,
      `No se puede eliminar este ${tipo} porque ya ha sido usado en pedidos. Solo puedes inhabilitarlo.`,
    )
  }
}

export async function eliminarProducto(id: number): Promise<void> {
  await assertSinUsoEnPedidos("producto", id)
  const eliminados = await db.delete(productos).where(eq(productos.id, id)).returning({ id: productos.id })
  if (eliminados.length === 0) throw new HttpError(404, "Producto no encontrado")
}

export async function alternarEstadoProducto(id: number): Promise<boolean> {
  const [producto] = await db
    .update(productos)
    .set({ activo: sql`NOT ${productos.activo}`, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(productos.id, id))
    .returning({ activo: productos.activo })
  if (!producto) throw new HttpError(404, "Producto no encontrado")
  return producto.activo ?? false
}

// --- Servicios -----------------------------------------------------------------------

export async function listarServicios(filtros: { search?: string; activo?: boolean }) {
  return db
    .select()
    .from(servicios)
    .where(
      and(
        filtros.search ? ilike(servicios.nombre, `%${filtros.search}%`) : undefined,
        filtros.activo !== undefined ? eq(servicios.activo, filtros.activo) : undefined,
      ),
    )
    .orderBy(asc(servicios.nombre))
}

export async function obtenerServicio(id: number) {
  const [servicio] = await db.select().from(servicios).where(eq(servicios.id, id))
  if (!servicio) throw new HttpError(404, "Servicio no encontrado")
  return servicio
}

export async function crearServicio(datos: DatosServicio) {
  const [servicio] = await db
    .insert(servicios)
    .values({ ...datos, precio_base: money(datos.precio_base) })
    .returning()
  return servicio
}

export async function actualizarServicio(id: number, datos: DatosServicio) {
  const [servicio] = await db
    .update(servicios)
    .set({ ...datos, precio_base: money(datos.precio_base), updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(servicios.id, id))
    .returning()
  if (!servicio) throw new HttpError(404, "Servicio no encontrado")
  return servicio
}

export async function eliminarServicio(id: number): Promise<void> {
  await assertSinUsoEnPedidos("servicio", id)
  const eliminados = await db.delete(servicios).where(eq(servicios.id, id)).returning({ id: servicios.id })
  if (eliminados.length === 0) throw new HttpError(404, "Servicio no encontrado")
}

export async function alternarEstadoServicio(id: number): Promise<boolean> {
  const [servicio] = await db
    .update(servicios)
    .set({ activo: sql`NOT ${servicios.activo}`, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(servicios.id, id))
    .returning({ activo: servicios.activo })
  if (!servicio) throw new HttpError(404, "Servicio no encontrado")
  return servicio.activo ?? false
}

// --- Catálogo público ---------------------------------------------------------------

export async function productosDelCatalogo(filtros: { search?: string; categoria?: string }) {
  return db
    .select({
      id: productos.id,
      sku: productos.sku,
      nombre: productos.nombre,
      precio: productos.precio,
      stock: productos.stock,
      activo: productos.activo,
    })
    .from(productos)
    .where(
      and(
        eq(productos.activo, true),
        filtros.search
          ? or(ilike(productos.nombre, `%${filtros.search}%`), ilike(productos.sku, `%${filtros.search}%`))
          : undefined,
        filtros.categoria ? ilike(productos.nombre, `%${filtros.categoria}%`) : undefined,
      ),
    )
    .orderBy(asc(productos.nombre))
}

export async function serviciosDelCatalogo(filtros: { search?: string }) {
  return db
    .select({
      id: servicios.id,
      nombre: servicios.nombre,
      unidad: servicios.unidad,
      precio_base: servicios.precio_base,
      variable: servicios.variable,
      activo: servicios.activo,
    })
    .from(servicios)
    .where(and(eq(servicios.activo, true), filtros.search ? ilike(servicios.nombre, `%${filtros.search}%`) : undefined))
    .orderBy(asc(servicios.nombre))
}

export async function tarifasDeEnvio() {
  return db
    .select({
      id: tarifasEnvio.id,
      ciudad: tarifasEnvio.ciudad,
      provincia: tarifasEnvio.provincia,
      costo: tarifasEnvio.costo,
    })
    .from(tarifasEnvio)
    .where(eq(tarifasEnvio.activo, true))
    .orderBy(asc(tarifasEnvio.ciudad))
}

// Productos y servicios activos para la grilla del catálogo público, con los
// precios como número. El servicio "Envío" no se vende suelto.
export async function itemsDelCatalogo(search?: string) {
  const [productosActivos, serviciosActivos] = await Promise.all([
    db
      .select({
        id: productos.id,
        sku: productos.sku,
        nombre: productos.nombre,
        precio: productos.precio,
        stock: productos.stock,
        imagen_url: productos.imagen_url,
      })
      .from(productos)
      .where(
        and(
          eq(productos.activo, true),
          search ? or(ilike(productos.nombre, `%${search}%`), ilike(productos.sku, `%${search}%`)) : undefined,
        ),
      )
      .orderBy(asc(productos.nombre)),
    db
      .select({
        id: servicios.id,
        nombre: servicios.nombre,
        unidad: servicios.unidad,
        precio: servicios.precio_base,
        variable: servicios.variable,
        imagen_url: servicios.imagen_url,
      })
      .from(servicios)
      .where(
        and(
          eq(servicios.activo, true),
          ne(servicios.nombre, SERVICIO_ENVIO),
          search ? ilike(servicios.nombre, `%${search}%`) : undefined,
        ),
      )
      .orderBy(asc(servicios.nombre)),
  ])

  return {
    productos: productosActivos.map((p) => ({
      ...p,
      tipo: "producto" as const,
      precio: Number.parseFloat(p.precio),
      stock: p.stock ?? 0,
    })),
    servicios: serviciosActivos.map((s) => ({ ...s, tipo: "servicio" as const, precio: Number.parseFloat(s.precio) })),
  }
}
