import "server-only"

import { and, asc, desc, eq, getTableColumns, ilike, or, sql, sum } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { HttpError } from "@/lib/http"
import { db, withTx } from "@/server/db/client"
import {
  clientes,
  PEDIDO_ESTADOS,
  pagos,
  pedidoFacturas,
  pedidoItems,
  pedidos,
  servicios,
  tarifasEnvio,
} from "@/server/db/schema"
import type { AgregarItem, CrearPedidoCatalogo, EditarItem } from "@/server/validators/pedidos"
import {
  fromCents,
  pgErrorCode,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  siguienteCodigo,
  toCents,
} from "./_shared"
import { buscarServicioEnvio, crearEnvioAutomatico, SERVICIO_ENVIO } from "./envios"
import { assertPedidoEditable, bloquearPedido, generarCodigoPedido, recalcularTotalPedido } from "./pedido-base"
import { ajustarStock, descontarStock, devolverStock } from "./stock"
import { registrarAuditoria } from "./auditoria"

const IVA_RATE = 0.15 // mismo porcentaje que las facturas de proveedores

// --- Lecturas ---------------------------------------------------------------------

export async function listarPedidos(filtros: { estado?: string; cliente_id?: number; search?: string }) {
  return db
    .select({
      ...getTableColumns(pedidos),
      cliente_nombre: clientes.nombre,
      cliente_telefono: clientes.telefono,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(
      and(
        filtros.estado ? sql`${pedidos.estado} = ${filtros.estado}` : undefined,
        filtros.cliente_id ? eq(pedidos.cliente_id, filtros.cliente_id) : undefined,
        filtros.search
          ? or(ilike(pedidos.codigo, `%${filtros.search}%`), ilike(clientes.nombre, `%${filtros.search}%`))
          : undefined,
      ),
    )
    .orderBy(desc(pedidos.created_at))
}

export async function obtenerPedido(id: number) {
  const [pedido] = await db
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      cliente_id: pedidos.cliente_id,
      estado: pedidos.estado,
      fecha_creacion: pedidos.fecha_creacion,
      total: pedidos.total,
      notas: pedidos.notas,
      created_at: pedidos.created_at,
      updated_at: pedidos.updated_at,
      cliente_nombre: clientes.nombre,
      cliente_telefono: clientes.telefono,
      cliente_email: clientes.email,
      cliente_direccion: clientes.direccion,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(eq(pedidos.id, id))
  if (!pedido) throw new HttpError(404, "Pedido no encontrado")

  const items = await db
    .select()
    .from(pedidoItems)
    .where(eq(pedidoItems.pedido_id, id))
    .orderBy(asc(pedidoItems.created_at))

  return { ...pedido, items }
}

export async function listarPedidosDeCliente(clienteId: number) {
  return db
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      estado: pedidos.estado,
      total: pedidos.total,
      fecha_creacion: pedidos.fecha_creacion,
      created_at: pedidos.created_at,
      updated_at: pedidos.updated_at,
    })
    .from(pedidos)
    .where(eq(pedidos.cliente_id, clienteId))
    .orderBy(desc(pedidos.created_at))
}

// --- Pedido -------------------------------------------------------------------------

export async function crearPedido(clienteId: number) {
  return withTx(async (tx) => {
    const [cliente] = await tx.select({ id: clientes.id }).from(clientes).where(eq(clientes.id, clienteId))
    if (!cliente) throw new HttpError(404, "Cliente no encontrado")

    const [pedido] = await tx
      .insert(pedidos)
      .values({ codigo: await generarCodigoPedido(tx), cliente_id: clienteId, estado: "recibido", total: "0" })
      .returning()
    return pedido
  })
}

export async function actualizarEstadoPedido(id: number, estado: (typeof PEDIDO_ESTADOS)[number]) {
  return withTx(async (tx) => {
    const pedido = await bloquearPedido(tx, id)

    if (estado === "terminado") {
      const [{ pagado }] = await tx
        .select({ pagado: sum(pagos.monto) })
        .from(pagos)
        .where(eq(pagos.pedido_id, id))
      const saldo = toCents(pedido.total) - toCents(pagado)
      if (saldo > 0) {
        throw new HttpError(400, `No se puede completar el pedido con saldo pendiente de $${fromCents(saldo)}`)
      }
      if (pedido.ciudad_envio) {
        await crearEnvioAutomatico(tx, id)
      }
    }

    const [actualizado] = await tx
      .update(pedidos)
      .set({ estado, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(pedidos.id, id))
      .returning()
    return actualizado
  })
}

// Elimina el pedido y devuelve al inventario el stock de sus productos.
// Si ya tiene cobros, envíos o factura, la FK lo impide y no se toca nada.
export async function eliminarPedido(id: number): Promise<void> {
  try {
    await withTx(async (tx) => {
      await bloquearPedido(tx, id)
      const items = await tx
        .select({ item_id: pedidoItems.item_id, cantidad: pedidoItems.cantidad })
        .from(pedidoItems)
        .where(and(eq(pedidoItems.pedido_id, id), eq(pedidoItems.item_tipo, "producto")))
      for (const item of items) {
        await devolverStock(tx, item.item_id, Math.floor(Number(item.cantidad)))
      }
      // pedido_items se borra en cascada.
      await tx.delete(pedidos).where(eq(pedidos.id, id))
    })
  } catch (error) {
    if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
      throw new HttpError(400, "No se puede eliminar un pedido con cobros, envíos, factura o diseños asociados")
    }
    throw error
  }
}

// --- Ítems --------------------------------------------------------------------------

export async function agregarItem(user: UserPayload, pedidoId: number, input: AgregarItem) {
  return withTx(async (tx) => {
    const pedido = await bloquearPedido(tx, pedidoId)
    assertPedidoEditable(user, pedido.estado, "No se pueden agregar items a un pedido terminado o anulado")

    if (input.item_tipo === "producto") {
      await descontarStock(tx, input.item_id, input.cantidad)
    } else {
      const [servicio] = await tx.select({ id: servicios.id }).from(servicios).where(eq(servicios.id, input.item_id))
      if (!servicio) throw new HttpError(404, "Servicio no encontrado")
    }

    const precio = toCents(input.precio_unitario)
    const [item] = await tx
      .insert(pedidoItems)
      .values({
        pedido_id: pedidoId,
        item_tipo: input.item_tipo,
        item_id: input.item_id,
        descripcion: input.descripcion,
        cantidad: String(input.cantidad),
        precio_unitario: fromCents(precio),
        subtotal: fromCents(precio * input.cantidad),
      })
      .returning()

    await recalcularTotalPedido(tx, pedidoId)
    return item
  })
}

export async function editarItem(user: UserPayload, pedidoId: number, itemId: number, input: EditarItem) {
  return withTx(async (tx) => {
    const pedido = await bloquearPedido(tx, pedidoId)
    assertPedidoEditable(user, pedido.estado, "No se pueden modificar items de un pedido terminado o anulado")

    const [actual] = await tx
      .select()
      .from(pedidoItems)
      .where(and(eq(pedidoItems.id, itemId), eq(pedidoItems.pedido_id, pedidoId)))
    if (!actual) throw new HttpError(404, "Item no encontrado")

    const cantidad = input.cantidad ?? Number(actual.cantidad)
    const precio =
      input.precio_unitario !== undefined ? toCents(input.precio_unitario) : toCents(actual.precio_unitario)

    // Si cambia la cantidad de un producto, el stock se ajusta por la diferencia.
    if (actual.item_tipo === "producto") {
      await ajustarStock(tx, actual.item_id, cantidad - Number(actual.cantidad))
    }

    const [item] = await tx
      .update(pedidoItems)
      .set({
        cantidad: String(cantidad),
        precio_unitario: fromCents(precio),
        descripcion: input.descripcion !== undefined ? input.descripcion : actual.descripcion,
        subtotal: fromCents(Math.round(precio * cantidad)),
      })
      .where(eq(pedidoItems.id, itemId))
      .returning()

    await recalcularTotalPedido(tx, pedidoId)
    return item
  })
}

export async function eliminarItem(user: UserPayload, pedidoId: number, itemId: number): Promise<void> {
  await withTx(async (tx) => {
    const pedido = await bloquearPedido(tx, pedidoId)
    assertPedidoEditable(user, pedido.estado, "No se pueden eliminar items de un pedido terminado o anulado")

    // El DELETE … RETURNING decide qué stock devolver: si dos peticiones
    // borran el mismo ítem, solo la primera lo encuentra.
    const [item] = await tx
      .delete(pedidoItems)
      .where(and(eq(pedidoItems.id, itemId), eq(pedidoItems.pedido_id, pedidoId)))
      .returning()
    if (!item) throw new HttpError(404, "Item no encontrado")

    if (item.item_tipo === "producto") {
      await devolverStock(tx, item.item_id, Math.floor(Number(item.cantidad)))
    }
    await recalcularTotalPedido(tx, pedidoId)
  })
}

// --- Checkout del catálogo ------------------------------------------------------

// Crea el pedido de un cliente del portal en una sola transacción: datos del
// cliente, ítems con precio real de la BD, descuento de stock, costo de envío
// según tarifas_envio. Si cualquier paso falla, no queda nada a medias.
export async function crearPedidoDesdeCatalogo(clienteId: number, input: CrearPedidoCatalogo) {
  return withTx(async (tx) => {
    // El pedido siempre es del cliente autenticado: nunca se busca por la
    // cédula del body (evita secuestrar la fila de otro cliente).
    await tx
      .update(clientes)
      .set({
        nombre: input.cliente.nombre,
        cedula: sql`COALESCE(${clientes.cedula}, ${input.cliente.cedula})`,
        telefono: input.cliente.telefono,
        direccion: input.cliente.direccion,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(clientes.id, clienteId))

    const items: { tipo: "producto" | "servicio"; id: number; nombre: string; cantidad: number; precio: number }[] = []
    for (const item of input.items) {
      if (item.tipo === "producto") {
        const producto = await descontarStock(tx, item.id, item.cantidad, { soloActivos: true })
        items.push({ ...item, nombre: producto.nombre, precio: toCents(producto.precio) })
      } else {
        const [servicio] = await tx
          .select({ nombre: servicios.nombre, precio_base: servicios.precio_base })
          .from(servicios)
          .where(and(eq(servicios.id, item.id), eq(servicios.activo, true)))
        if (!servicio) throw new HttpError(400, "Servicio no encontrado o inactivo")
        items.push({ ...item, nombre: servicio.nombre, precio: toCents(servicio.precio_base) })
      }
    }

    const esEnvio = input.metodoEntrega === "envio"
    let costoEnvio = 0
    if (esEnvio) {
      const [tarifa] = await tx
        .select({ costo: tarifasEnvio.costo })
        .from(tarifasEnvio)
        .where(and(eq(tarifasEnvio.ciudad, input.ciudadEnvio ?? ""), eq(tarifasEnvio.activo, true)))
        .limit(1)
      if (!tarifa) throw new HttpError(400, "No hay tarifa de envío configurada para esa ciudad")
      costoEnvio = toCents(tarifa.costo)
    }

    const subtotal = items.reduce((acc, item) => acc + Math.round(item.precio * item.cantidad), 0)
    const total = subtotal + costoEnvio

    let notas = `Método de entrega: ${esEnvio ? "Envío a Domicilio" : "Retiro en Tienda"}`
    if (esEnvio && input.ciudadEnvio) notas += `\nCiudad de envío: ${input.ciudadEnvio}`
    if (esEnvio && input.direccionEnvio && input.direccionEnvio !== input.cliente.direccion) {
      notas += `\nDirección de envío: ${input.direccionEnvio}`
    }

    const [pedido] = await tx
      .insert(pedidos)
      .values({
        codigo: await generarCodigoPedido(tx),
        cliente_id: clienteId,
        estado: "recibido",
        total: fromCents(total),
        notas,
        costo_envio: fromCents(costoEnvio),
        ciudad_envio: esEnvio ? input.ciudadEnvio : null,
      })
      .returning({ id: pedidos.id, codigo: pedidos.codigo, total: pedidos.total })

    await tx.insert(pedidoItems).values(
      items.map((item) => ({
        pedido_id: pedido.id,
        item_tipo: item.tipo,
        item_id: item.id,
        descripcion: item.nombre,
        cantidad: String(item.cantidad),
        precio_unitario: fromCents(item.precio),
        subtotal: fromCents(Math.round(item.precio * item.cantidad)),
      })),
    )

    if (esEnvio && costoEnvio > 0) {
      const servicioEnvio = await buscarServicioEnvio(tx)
      if (servicioEnvio) {
        await tx.insert(pedidoItems).values({
          pedido_id: pedido.id,
          item_tipo: "servicio",
          item_id: servicioEnvio.id,
          descripcion: SERVICIO_ENVIO,
          cantidad: "1",
          precio_unitario: fromCents(costoEnvio),
          subtotal: fromCents(costoEnvio),
        })
      }
    }

    return pedido
  })
}

// --- Factura ------------------------------------------------------------------------

export async function obtenerFactura(pedidoId: number) {
  const [factura] = await db
    .select({
      ...getTableColumns(pedidoFacturas),
      pedido_codigo: pedidos.codigo,
      cliente_nombre: clientes.nombre,
      cliente_cedula: clientes.cedula,
    })
    .from(pedidoFacturas)
    .innerJoin(pedidos, eq(pedidoFacturas.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(eq(pedidoFacturas.pedido_id, pedidoId))
  return factura ?? null
}

export async function generarFactura(user: UserPayload, pedidoId: number) {
  try {
    const factura = await withTx(async (tx) => {
      const pedido = await bloquearPedido(tx, pedidoId)

      const [existente] = await tx
        .select({ id: pedidoFacturas.id })
        .from(pedidoFacturas)
        .where(eq(pedidoFacturas.pedido_id, pedidoId))
      if (existente) throw new HttpError(400, "Este pedido ya tiene una factura generada")
      if (pedido.estado === "anulado") throw new HttpError(400, "No se puede facturar un pedido anulado")

      const items = await tx
        .select({ subtotal: pedidoItems.subtotal })
        .from(pedidoItems)
        .where(eq(pedidoItems.pedido_id, pedidoId))
      if (items.length === 0) throw new HttpError(400, "El pedido no tiene ítems para facturar")

      const subtotal = items.reduce((acc, item) => acc + toCents(item.subtotal), 0)
      const iva = Math.round(subtotal * IVA_RATE)

      const year = new Date().getFullYear()
      const numeroFactura = await siguienteCodigo(tx, {
        prefix: `FACT-${year}-`,
        seqName: `factura_numero_seq_${year}`,
        padding: 4,
      })

      const [creada] = await tx
        .insert(pedidoFacturas)
        .values({
          pedido_id: pedidoId,
          numero_factura: numeroFactura,
          subtotal: fromCents(subtotal),
          iva: fromCents(iva),
          total: fromCents(subtotal + iva),
        })
        .returning()
      return { factura: creada, codigo: pedido.codigo }
    })

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "crear",
      modulo: "pedidos",
      descripcion: `Generó factura ${factura.factura.numero_factura} para el pedido ${factura.codigo}`,
    })
    return factura.factura
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw new HttpError(400, "Este pedido ya tiene una factura generada")
    }
    throw error
  }
}
