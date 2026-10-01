// Datos mínimos para los tests de servicios. Cada helper inserta una fila con
// valores por defecto razonables y devuelve la fila creada.

import { eq } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { db } from "@/server/db/client"
import { clientes, productos, servicios, tarifasEnvio } from "@/server/db/schema"
import { SERVICIO_ENVIO } from "@/server/services/envios"

export const admin: UserPayload = { id: 1, email: "admin@test.local", nombre: "Admin", rol: "administrador", rol_id: 1 }
export const asistente: UserPayload = {
  id: 2,
  email: "asistente@test.local",
  nombre: "Asistente",
  rol: "asistente",
  rol_id: 2,
}

let seq = 0

export async function crearCliente(datos: Partial<typeof clientes.$inferInsert> = {}) {
  seq++
  const [row] = await db
    .insert(clientes)
    .values({ nombre: `Cliente ${seq}`, cedula: `09${String(seq).padStart(8, "0")}`, telefono: "0999999999", ...datos })
    .returning()
  return row
}

export async function crearProducto(datos: Partial<typeof productos.$inferInsert> = {}) {
  seq++
  const [row] = await db
    .insert(productos)
    .values({ nombre: `Tutu ${seq}`, sku: `SKU-${seq}`, precio: "25.00", stock: 10, ...datos })
    .returning()
  return row
}

export async function crearServicio(datos: Partial<typeof servicios.$inferInsert> = {}) {
  seq++
  const [row] = await db
    .insert(servicios)
    .values({ nombre: `Servicio ${seq}`, precio_base: "15.00", ...datos })
    .returning()
  return row
}

// El servicio "Envío" que el checkout agrega como ítem y del que depende la
// creación automática del envío al completar el pago.
export async function crearServicioEnvio() {
  return crearServicio({ nombre: SERVICIO_ENVIO, precio_base: "0.00", variable: true })
}

export async function crearTarifa(ciudad: string, costo: string) {
  const [row] = await db.insert(tarifasEnvio).values({ ciudad, costo }).returning()
  return row
}

export async function stockDe(productoId: number): Promise<number> {
  const [row] = await db.select({ stock: productos.stock }).from(productos).where(eq(productos.id, productoId))
  return row.stock ?? 0
}
