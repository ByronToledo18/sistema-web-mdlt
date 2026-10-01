"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/server/auth/action"
import { actualizarEnvio, pagarServientrega } from "@/server/services/envios"
import { id, requiredText } from "@/server/validators/common"
import { pagarServientregaBody } from "@/server/validators/pagos"

const registrarGuiaBody = z.object({
  envio_id: id("Envío"),
  guia: requiredText("Ingresa el número de guía generado en el portal de Servientrega"),
})

// Servientrega no tiene API de autoservicio: la guía se genera a mano en su
// portal y aquí se registra el número real. Al despachar un envío pendiente,
// el servicio carga su costo a la cuenta del mes.
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
