"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/server/auth/action"
import { actualizarEnvio, pagarServientrega } from "@/server/services/envios"
import { id, requiredText } from "@/server/validators/common"
import { pagarServientregaBody } from "@/server/validators/pagos"
import {
  actualizarEstadoGuia,
  anularGuiaServientrega,
  formularioGuiaServientrega,
  generarGuiaServientrega,
} from "@/server/services/servientrega"
import { envioIdBody, generarGuiaServientregaBody } from "@/server/validators/servientrega"

const registrarGuiaBody = z.object({
  envio_id: id("Envío"),
  guia: requiredText("Ingresa el número de guía generado en el portal de Servientrega"),
})

// Registro manual de una guía hecha en el portal de Servientrega (sigue
// disponible aunque la integración por API no esté configurada). Al despachar
// un envío pendiente, el servicio carga su costo a la cuenta del mes.
export async function registrarGuiaAction(input: unknown) {
  return adminAction({ permission: { module: "envios", action: "update" }, error: "Error al registrar la guía" }, async () => {
    const { envio_id, guia } = registrarGuiaBody.parse(input)
    const envio = await actualizarEnvio(envio_id, { estado: "en_proceso", guia })
    revalidatePath("/admin/envios")
    revalidatePath(`/admin/pedidos/${envio.pedido_id}`)
  })
}

export async function pagarServientregaAction(input: unknown) {
  return adminAction({ permission: { module: "servientrega", action: "update" }, error: "Error al registrar pago" }, async () => {
    await pagarServientrega(pagarServientregaBody.parse(input))
    revalidatePath("/admin/envios")
  })
}

// --- Guías por la API de Servientrega (server/services/servientrega.ts) ---------

function revalidarEnvio(pedidoId: number) {
  revalidatePath("/admin/envios")
  revalidatePath(`/admin/pedidos/${pedidoId}`)
}

// Ciudades y datos precargados del diálogo "Generar guía Servientrega".
export async function formularioGuiaServientregaAction(input: unknown) {
  return adminAction(
    { permission: { module: "envios", action: "update" }, error: "Error al cargar los datos de Servientrega" },
    async (user) => formularioGuiaServientrega(user, envioIdBody.parse(input).envio_id),
  )
}

export async function generarGuiaServientregaAction(input: unknown) {
  return adminAction(
    { permission: { module: "envios", action: "update" }, error: "Error al generar la guía de Servientrega" },
    async (user) => {
      const { envio_id } = envioIdBody.parse(input)
      const envio = await generarGuiaServientrega(user, envio_id, generarGuiaServientregaBody.parse(input))
      revalidarEnvio(envio.pedido_id)
      return { guia: envio.guia_servientrega }
    },
  )
}

export async function anularGuiaServientregaAction(input: unknown) {
  return adminAction(
    { permission: { module: "envios", action: "update" }, error: "Error al anular la guía de Servientrega" },
    async (user) => {
      const envio = await anularGuiaServientrega(user, envioIdBody.parse(input).envio_id)
      if (envio) revalidarEnvio(envio.pedido_id)
      else revalidatePath("/admin/envios")
    },
  )
}

// Trazabilidad (servicio SOAP): estado actual y movimientos de la guía.
export async function actualizarEstadoGuiaAction(input: unknown) {
  return adminAction(
    { permission: { module: "envios", action: "read" }, error: "Error al consultar el estado en Servientrega" },
    async (user) => {
      const resultado = await actualizarEstadoGuia(user, envioIdBody.parse(input).envio_id)
      revalidarEnvio(resultado.pedido_id)
      return resultado
    },
  )
}
