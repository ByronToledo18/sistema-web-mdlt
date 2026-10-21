import { z } from "zod"
import { PRODUCTO_SERVIENTREGA_IDS } from "@/lib/servientrega"
import { id, nonNegativeMoney, positiveMoney, requiredText } from "./common"

const texto = (message: string, max: number) =>
  requiredText(message).max(max, `${message.replace(/^Ingresa (el|la) /, "")}: máximo ${max} caracteres`)

// Diálogo "Generar guía Servientrega" (los datos del destinatario vienen
// precargados del pedido y el admin puede corregirlos).
export const generarGuiaServientregaBody = z.object({
  ciudad_destino_id: id("Ciudad de destino"),
  destinatario_identificacion: texto("Ingresa la cédula o RUC del destinatario", 20),
  destinatario_nombre: texto("Ingresa el nombre del destinatario", 150),
  destinatario_direccion: texto("Ingresa la dirección del destinatario", 200),
  destinatario_telefono: texto("Ingresa el teléfono del destinatario", 20),
  peso_kg: positiveMoney("Ingresa un peso mayor a 0").refine((n) => n <= 500, "Peso máximo 500 kg"),
  piezas: z.coerce
    .number({ error: "Ingresa el número de piezas" })
    .int("Las piezas deben ser un número entero")
    .min(1, "Al menos 1 pieza")
    .max(99, "Máximo 99 piezas"),
  contenido: texto("Ingresa el contenido del envío", 100),
  valor_mercancia: nonNegativeMoney("Ingresa el valor de la mercancía (0 o más)"),
  producto_id: z.coerce
    .number({ error: "Elige el producto de Servientrega" })
    .refine((v) => (PRODUCTO_SERVIENTREGA_IDS as number[]).includes(v), "Producto de Servientrega inválido"),
})

export type GenerarGuiaServientregaInput = z.input<typeof generarGuiaServientregaBody>

export const envioIdBody = z.object({ envio_id: id("Envío") })

export const tipoDocumentoGuia = z.object({
  tipo: z.enum(["a4", "rotulo"], { error: "Tipo de documento inválido (a4 o rotulo)" }).default("a4"),
})
