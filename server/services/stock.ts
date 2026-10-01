import "server-only"

import { and, eq, gte, sql } from "drizzle-orm"
import { HttpError } from "@/lib/http"
import type { Executor } from "@/server/db/client"
import { productos } from "@/server/db/schema"

// Descuenta stock de forma atómica: el UPDATE solo afecta la fila si alcanza
// el stock (`stock >= cantidad`), así dos pedidos simultáneos por la última
// unidad no pueden dejar el stock negativo. Si no alcanza, lanza 400 y la
// transacción que lo llamó hace rollback.
export async function descontarStock(
  ex: Executor,
  productoId: number,
  cantidad: number,
  opts: { soloActivos?: boolean } = {},
): Promise<{ nombre: string; precio: string }> {
  const [actualizado] = await ex
    .update(productos)
    .set({ stock: sql`${productos.stock} - ${cantidad}`, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(
      and(
        eq(productos.id, productoId),
        gte(productos.stock, cantidad),
        opts.soloActivos ? eq(productos.activo, true) : undefined,
      ),
    )
    .returning({ nombre: productos.nombre, precio: productos.precio })

  if (actualizado) return actualizado

  const [producto] = await ex
    .select({ nombre: productos.nombre, stock: productos.stock, activo: productos.activo })
    .from(productos)
    .where(eq(productos.id, productoId))

  if (!producto || (opts.soloActivos && !producto.activo)) {
    throw new HttpError(
      opts.soloActivos ? 400 : 404,
      opts.soloActivos ? "Producto no encontrado o inactivo" : "Producto no encontrado",
    )
  }
  throw new HttpError(400, `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock ?? 0} unidades`)
}

export async function devolverStock(ex: Executor, productoId: number, cantidad: number): Promise<void> {
  await ex
    .update(productos)
    .set({ stock: sql`${productos.stock} + ${cantidad}`, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(eq(productos.id, productoId))
}

// Ajusta el stock por la diferencia entre la cantidad nueva y la anterior de
// un ítem (positiva = se lleva más, negativa = devuelve).
export async function ajustarStock(ex: Executor, productoId: number, diferencia: number): Promise<void> {
  if (diferencia > 0) await descontarStock(ex, productoId, diferencia)
  else if (diferencia < 0) await devolverStock(ex, productoId, -diferencia)
}
