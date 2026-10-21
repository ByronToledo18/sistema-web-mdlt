import "server-only"

import { and, eq, sql, sum } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { HttpError } from "@/lib/http"
import { logger } from "@/lib/logger"
import { dividirNombre, GUIA_DEFAULTS, sugerirCiudad, type CiudadServientrega } from "@/lib/servientrega"
import { assertCan } from "@/server/auth/guard"
import { db, withTx } from "@/server/db/client"
import { clientes, envios, pedidoItems, pedidos, servientregaRotulos } from "@/server/db/schema"
import {
  crearClienteServientrega,
  leerConfig,
  leerRemitente,
  ServientregaError,
  type ClienteServientrega,
} from "@/server/integraciones/servientrega"
import { generarGuiaServientregaBody, type GenerarGuiaServientregaInput } from "@/server/validators/servientrega"
import { registrarAuditoria } from "./auditoria"
import { fromCents, toCents } from "./_shared"

// Guías de Servientrega generadas desde el admin con la API (botón manual).
//
// Concurrencia al generar (no se pueden generar dos guías para un envío):
// 1. Transacción corta: SELECT … FOR UPDATE del envío, se valida que no tenga
//    una guía vigente ni otra generación en curso y se marca
//    servientrega_estado = 'generando'. COMMIT.
// 2. Llamada a la API FUERA de la transacción: no se mantiene una conexión ni
//    un bloqueo de fila abiertos durante hasta 20 s de red.
// 3. UPDATE condicionado a servientrega_estado = 'generando' con el número de
//    guía. Si la API falla, se devuelve el estado anterior.
// Una segunda petición simultánea encuentra la marca y responde 409. Si el
// proceso muere entre 1 y 3 la marca queda colgada: pasado MARCA_VENCIDA se
// permite reintentar (con un warning en el log, porque la guía pudo haberse
// generado en Servientrega igual).

const CONTEXTO = "services/servientrega"
const MARCA_VENCIDA = sql.raw("interval '2 minutes'")

// Errores de la integración → HttpError con un mensaje para la UI. Se usa 424
// (y no 5xx) para que adminAction/withAuth muestren el motivo al admin.
function aHttpError(error: unknown): unknown {
  if (!(error instanceof ServientregaError)) return error
  switch (error.tipo) {
    case "no_configurada":
      return new HttpError(400, error.message)
    case "timeout":
      return new HttpError(424, "Servientrega no respondió a tiempo. Intenta de nuevo en unos minutos.")
    case "red":
      return new HttpError(424, "No se pudo conectar con Servientrega. Intenta de nuevo en unos minutos.")
    case "rechazada":
      return new HttpError(424, `Servientrega: ${error.message}`)
    default:
      return new HttpError(424, error.message)
  }
}

function cliente(): ClienteServientrega {
  try {
    return crearClienteServientrega(leerConfig())
  } catch (error) {
    throw aHttpError(error)
  }
}

async function conServientrega<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw aHttpError(error)
  }
}

async function datosDelEnvio(envioId: number) {
  const [fila] = await db
    .select({
      envio_id: envios.id,
      guia_interna: envios.guia,
      guia_servientrega: envios.guia_servientrega,
      servientrega_estado: envios.servientrega_estado,
      pedido_id: pedidos.id,
      pedido_codigo: pedidos.codigo,
      ciudad_envio: pedidos.ciudad_envio,
      cliente_nombre: clientes.nombre,
      cliente_cedula: clientes.cedula,
      cliente_direccion: clientes.direccion,
      cliente_telefono: clientes.telefono,
    })
    .from(envios)
    .innerJoin(pedidos, eq(envios.pedido_id, pedidos.id))
    .innerJoin(clientes, eq(pedidos.cliente_id, clientes.id))
    .where(eq(envios.id, envioId))
  if (!fila) throw new HttpError(404, "Envío no encontrado")
  return fila
}

// Subtotal de los productos del pedido (sin servicios como el envío, sin IVA).
async function subtotalProductos(pedidoId: number): Promise<number> {
  const [{ total }] = await db
    .select({ total: sum(pedidoItems.subtotal) })
    .from(pedidoItems)
    .where(and(eq(pedidoItems.pedido_id, pedidoId), eq(pedidoItems.item_tipo, "producto")))
  return Number(fromCents(toCents(total)))
}

export interface FormularioGuia {
  ciudades: CiudadServientrega[]
  ciudad_sugerida_id: number | null
  ciudad_pedido: string | null
  destinatario: { identificacion: string; nombre: string; direccion: string; telefono: string }
  valor_mercancia: number
  peso_kg: number
  piezas: number
  contenido: string
  producto_id: number
}

// Datos para precargar el diálogo "Generar guía Servientrega".
export async function formularioGuiaServientrega(user: UserPayload, envioId: number): Promise<FormularioGuia> {
  assertCan(user, "envios", "update")
  const api = cliente()
  const datos = await datosDelEnvio(envioId)
  const [ciudades, valor] = await Promise.all([
    conServientrega(() => api.listarCiudades()),
    subtotalProductos(datos.pedido_id),
  ])
  return {
    ciudades,
    ciudad_sugerida_id: sugerirCiudad(ciudades, datos.ciudad_envio, datos.cliente_direccion),
    ciudad_pedido: datos.ciudad_envio,
    destinatario: {
      identificacion: datos.cliente_cedula ?? "",
      nombre: datos.cliente_nombre,
      direccion: datos.cliente_direccion ?? "",
      telefono: datos.cliente_telefono ?? "",
    },
    valor_mercancia: valor,
    ...GUIA_DEFAULTS,
  }
}

export async function generarGuiaServientrega(user: UserPayload, envioId: number, rawInput: GenerarGuiaServientregaInput) {
  assertCan(user, "envios", "update")
  const api = cliente()
  let remitente
  try {
    remitente = leerRemitente()
  } catch (error) {
    throw aHttpError(error)
  }
  const input = generarGuiaServientregaBody.parse(rawInput)
  const datos = await datosDelEnvio(envioId)

  // 1. Reserva: marca 'generando' bajo FOR UPDATE.
  const estadoPrevio = await withTx(async (tx) => {
    const [envio] = await tx
      .select({
        guia_servientrega: envios.guia_servientrega,
        servientrega_estado: envios.servientrega_estado,
        marca_vigente: sql<boolean>`coalesce(${envios.updated_at} > CURRENT_TIMESTAMP - ${MARCA_VENCIDA}, false)`,
      })
      .from(envios)
      .where(eq(envios.id, envioId))
      .for("update")
    if (!envio) throw new HttpError(404, "Envío no encontrado")
    if (envio.servientrega_estado === "generada") {
      throw new HttpError(409, `El envío ya tiene la guía de Servientrega ${envio.guia_servientrega}. Anúlala antes de generar otra.`)
    }
    if (envio.servientrega_estado === "generando") {
      if (envio.marca_vigente) {
        throw new HttpError(409, "Ya se está generando una guía para este envío. Espera unos segundos y recarga la página.")
      }
      logger.warn(CONTEXTO, "marca 'generando' vencida: se reintenta la generación", { envio_id: envioId })
    }
    await tx
      .update(envios)
      .set({ servientrega_estado: "generando", updated_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(envios.id, envioId))
    // Si había una guía, estaba anulada (una 'generada' se rechazó arriba).
    return envio.guia_servientrega ? ("anulada" as const) : null
  })

  const liberarMarca = () =>
    db
      .update(envios)
      .set({ servientrega_estado: estadoPrevio, updated_at: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(envios.id, envioId), eq(envios.servientrega_estado, "generando")))

  // 2. Llamada a la API fuera de la transacción.
  const { nombre, apellido } = dividirNombre(input.destinatario_nombre)
  let generada
  try {
    generada = await api.generarGuia({
      ciudad_origen_id: remitente.ciudad_id,
      ciudad_destino_id: input.ciudad_destino_id,
      remitente: {
        identificacion: remitente.identificacion,
        razon_social: remitente.razon_social,
        nombre: remitente.nombre,
        apellido: remitente.apellido,
        direccion: remitente.direccion,
        sector: remitente.sector,
        telefono: remitente.telefono,
      },
      destinatario: {
        identificacion: input.destinatario_identificacion,
        razon_social: input.destinatario_nombre,
        nombre,
        apellido,
        direccion: input.destinatario_direccion,
        telefono: input.destinatario_telefono,
      },
      producto_id: input.producto_id,
      contenido: input.contenido,
      piezas: input.piezas,
      peso_kg: input.peso_kg,
      valor_mercancia: input.valor_mercancia,
      referencia_1: `Pedido ${datos.pedido_codigo}`,
      referencia_2: datos.guia_interna ?? "",
    })
  } catch (error) {
    await liberarMarca().catch((e) => logger.error(`${CONTEXTO}: no se pudo liberar la marca 'generando'`, e, { envio_id: envioId }))
    if (error instanceof ServientregaError && (error.tipo === "timeout" || error.tipo === "red")) {
      // Resultado incierto: la guía pudo haberse creado en Servientrega.
      throw new HttpError(
        424,
        `${(aHttpError(error) as HttpError).message} La guía pudo haberse generado igual: revisa en el portal de Servientrega (referencia "Pedido ${datos.pedido_codigo}") antes de reintentar.`,
      )
    }
    throw aHttpError(error)
  }

  // 3. Guarda el número. Si falla, el número queda en el log para no perderlo.
  try {
    const [envio] = await db
      .update(envios)
      .set({
        guia_servientrega: generada.numero,
        servientrega_estado: "generada",
        servientrega_ciudad_destino_id: input.ciudad_destino_id,
        servientrega_producto_id: input.producto_id,
        peso_kg: input.peso_kg.toFixed(2),
        piezas: input.piezas,
        contenido: input.contenido,
        guia_generada_at: sql`CURRENT_TIMESTAMP`,
        guia_anulada_at: null,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(envios.id, envioId), eq(envios.servientrega_estado, "generando")))
      .returning()
    if (!envio) throw new Error("el envío ya no estaba en estado 'generando'")

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "GENERAR_GUIA_SERVIENTREGA",
      modulo: "envios",
      descripcion: `Guía Servientrega ${generada.numero} del envío ${envio.guia ?? envio.id} (pedido ${datos.pedido_codigo})`,
      metadata: {
        envio_id: envio.id,
        pedido_id: envio.pedido_id,
        guia_servientrega: generada.numero,
        ciudad_destino_id: input.ciudad_destino_id,
        producto_id: input.producto_id,
        peso_kg: input.peso_kg,
        piezas: input.piezas,
      },
    })
    return envio
  } catch (error) {
    logger.error(`${CONTEXTO}: guía generada en Servientrega pero NO guardada`, error, {
      envio_id: envioId,
      guia_servientrega: generada.numero,
    })
    throw new HttpError(
      424,
      `Servientrega generó la guía ${generada.numero} pero no se pudo guardar en el envío. Anota el número y avisa a soporte.`,
    )
  }
}

export async function anularGuiaServientrega(user: UserPayload, envioId: number) {
  assertCan(user, "envios", "update")
  const api = cliente()
  const [envio] = await db
    .select({ guia_servientrega: envios.guia_servientrega, servientrega_estado: envios.servientrega_estado })
    .from(envios)
    .where(eq(envios.id, envioId))
  if (!envio) throw new HttpError(404, "Envío no encontrado")
  if (envio.servientrega_estado !== "generada" || !envio.guia_servientrega) {
    throw new HttpError(409, "El envío no tiene una guía de Servientrega vigente")
  }
  const numero = envio.guia_servientrega

  // Sin bloqueo durante la llamada: mientras la guía siga 'generada' nadie
  // puede generar otra, y una anulación doble la rechaza Servientrega.
  const { mensaje } = await conServientrega(() => api.anularGuia(numero))

  const [actualizado] = await db
    .update(envios)
    .set({ servientrega_estado: "anulada", guia_anulada_at: sql`CURRENT_TIMESTAMP`, updated_at: sql`CURRENT_TIMESTAMP` })
    .where(
      and(eq(envios.id, envioId), eq(envios.guia_servientrega, numero), eq(envios.servientrega_estado, "generada")),
    )
    .returning()
  if (!actualizado) {
    logger.warn(CONTEXTO, "guía anulada en Servientrega pero el envío ya había cambiado", {
      envio_id: envioId,
      guia_servientrega: numero,
    })
  }

  await registrarAuditoria({
    usuario_id: user.id,
    accion: "ANULAR_GUIA_SERVIENTREGA",
    modulo: "envios",
    descripcion: `Guía Servientrega ${numero} anulada (envío ${envioId})`,
    metadata: { envio_id: envioId, guia_servientrega: numero, respuesta: mensaje },
  })
  return actualizado ?? null
}

export type TipoDocumentoGuia = "a4" | "rotulo"

// PDF de la guía (A4) o del rótulo. El permiso (envíos: read) lo verifica el
// route handler con withAuth.
export async function descargarGuia(envioId: number, tipo: TipoDocumentoGuia): Promise<{ numero: string; pdf: Buffer }> {
  const [envio] = await db
    .select({ guia_servientrega: envios.guia_servientrega, servientrega_estado: envios.servientrega_estado })
    .from(envios)
    .where(eq(envios.id, envioId))
  if (!envio) throw new HttpError(404, "Envío no encontrado")
  if (envio.servientrega_estado !== "generada" || !envio.guia_servientrega) {
    throw new HttpError(409, "El envío no tiene una guía de Servientrega vigente")
  }
  const numero = envio.guia_servientrega

  if (tipo === "a4") {
    const api = cliente()
    return { numero, pdf: await conServientrega(() => api.obtenerPdfGuia(numero)) }
  }

  // Servientrega entrega el rótulo una sola vez: se guarda la primera descarga.
  const [guardado] = await db
    .select({ pdf_base64: servientregaRotulos.pdf_base64 })
    .from(servientregaRotulos)
    .where(eq(servientregaRotulos.guia_servientrega, numero))
  if (guardado) return { numero, pdf: Buffer.from(guardado.pdf_base64, "base64") }

  const api = cliente()
  let pdf: Buffer
  try {
    pdf = await api.obtenerRotulo(numero)
  } catch (error) {
    if (error instanceof ServientregaError && error.tipo === "rechazada") {
      throw new HttpError(
        409,
        `Servientrega ya no entrega el rótulo de esta guía (${error.message}). Descarga la guía A4 o pide el rótulo a Servientrega.`,
      )
    }
    throw aHttpError(error)
  }
  try {
    await db
      .insert(servientregaRotulos)
      .values({ guia_servientrega: numero, envio_id: envioId, pdf_base64: pdf.toString("base64") })
      .onConflictDoNothing({ target: servientregaRotulos.guia_servientrega })
  } catch (error) {
    // El rótulo igual se devuelve; solo se pierde la copia para la próxima vez.
    logger.error(`${CONTEXTO}: no se pudo guardar el rótulo`, error, { envio_id: envioId, guia_servientrega: numero })
  }
  return { numero, pdf }
}
