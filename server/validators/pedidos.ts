import { z } from "zod"
import { PEDIDO_ESTADOS } from "@/server/db/schema"
import { id, nonNegativeMoney, optionalText, requiredText } from "./common"

const cantidadEntera = z.coerce
  .number({ error: "La cantidad debe ser un número entero mayor a 0" })
  .int("La cantidad debe ser un número entero mayor a 0")
  .positive("La cantidad debe ser un número entero mayor a 0")

export const CANTIDAD_MAXIMA_CATALOGO = 999

export const listarPedidosQuery = z.object({
  estado: z.string().optional(),
  cliente_id: id("Cliente").optional(),
  search: z.string().optional(),
})

export const crearPedidoBody = z.object({
  cliente_id: z.coerce
    .number({ error: "El cliente es requerido" })
    .int("El cliente es requerido")
    .positive("El cliente es requerido"),
})

export const actualizarEstadoBody = z.object({
  estado: z.enum(PEDIDO_ESTADOS, { error: "Estado inválido" }),
})

export const pedidoItemParams = z.object({ id: id(), itemId: id() })

// Ítems agregados desde el admin. El precio lo pone quien carga el pedido (los
// servicios tienen precio variable), pero la cantidad siempre es entera porque
// el stock de productos es entero.
export const agregarItemBody = z.object({
  item_tipo: z.enum(["producto", "servicio"], { error: "Tipo de item inválido" }),
  item_id: id("Item"),
  descripcion: optionalText,
  cantidad: cantidadEntera,
  precio_unitario: nonNegativeMoney("El precio no puede ser negativo"),
})

export const editarItemBody = z.object({
  cantidad: cantidadEntera.optional(),
  precio_unitario: nonNegativeMoney("El precio no puede ser negativo").optional(),
  descripcion: z.string().nullish(),
})

// Checkout del catálogo público. Precio y costo de envío que mande el cliente
// se ignoran: se recalculan en el servidor.
export const crearPedidoCatalogoBody = z
  .object({
    cliente: z.object(
      {
        nombre: requiredText("Nombre, cédula y teléfono son requeridos"),
        cedula: requiredText("Nombre, cédula y teléfono son requeridos"),
        telefono: requiredText("Nombre, cédula y teléfono son requeridos"),
        direccion: optionalText,
      },
      { error: "Nombre, cédula y teléfono son requeridos" },
    ),
    items: z
      .array(
        z.object({
          id: id("Ítem de pedido"),
          tipo: z.enum(["producto", "servicio"], { error: "Tipo de ítem inválido" }),
          // Entera para productos y servicios: el carrito solo suma de a 1 y
          // `variable` en un servicio es precio variable, no cantidad
          // fraccionaria. El tope evita totales absurdos por un body a mano.
          cantidad: cantidadEntera.max(CANTIDAD_MAXIMA_CATALOGO, `La cantidad máxima por ítem es ${CANTIDAD_MAXIMA_CATALOGO}`),
        }),
        { error: "El pedido debe tener al menos un ítem" },
      )
      .min(1, "El pedido debe tener al menos un ítem"),
    metodoEntrega: z.enum(["envio", "retiro"], { error: "Método de entrega inválido" }),
    direccionEnvio: optionalText,
    ciudadEnvio: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.metodoEntrega !== "envio") return
    if (!data.cliente.direccion) {
      ctx.addIssue({ code: "custom", message: "La dirección es requerida para envío a domicilio" })
    } else if (!data.ciudadEnvio) {
      ctx.addIssue({ code: "custom", message: "La ciudad de envío es requerida" })
    }
  })

export type CrearPedidoCatalogo = z.output<typeof crearPedidoCatalogoBody>
export type AgregarItem = z.output<typeof agregarItemBody>
export type EditarItem = z.output<typeof editarItemBody>
