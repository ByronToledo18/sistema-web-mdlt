import { z } from "zod"
import { fechaNegocio } from "@/lib/fechas"
import { ENVIO_ESTADOS } from "@/server/db/schema"
import { id, isoDate, optionalText, positiveMoney, requiredText } from "./common"

export const pedidoIdQuery = z.object({ pedido_id: id("Pedido").optional() })

export const registrarPagoBody = z.object({
  pedido_id: z.coerce
    .number({ error: "Pedido y monto son requeridos" })
    .int()
    .positive("Pedido y monto son requeridos"),
  monto: positiveMoney("El monto debe ser mayor a 0"),
  metodo: optionalText,
  referencia: optionalText,
  observacion: optionalText,
})

export const periodoQuery = z.object({
  year: z.coerce
    .number({ error: "Año inválido" })
    .int("Año inválido")
    .min(2000, "Año inválido")
    .default(() => fechaNegocio().year),
  month: z.coerce
    .number({ error: "Mes inválido" })
    .int("Mes inválido")
    .min(1, "Mes inválido")
    .max(12, "Mes inválido")
    .default(() => fechaNegocio().month),
})

export const reporteQuery = z
  .object({
    start_date: isoDate("Fechas de inicio y fin son requeridas"),
    end_date: isoDate("Fechas de inicio y fin son requeridas"),
    format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json"),
  })
  .refine((q) => new Date(q.start_date) <= new Date(q.end_date), "La fecha de inicio debe ser menor a la fecha de fin")

// --- Envíos ---

export const crearEnvioBody = z.object({
  pedido_id: z.coerce.number({ error: "El pedido es requerido" }).int().positive("El pedido es requerido"),
  costo: positiveMoney("El costo de envío es requerido y debe ser mayor a 0"),
})

export const actualizarEnvioBody = z.object({
  estado: z.enum(ENVIO_ESTADOS, { error: "Estado inválido" }).optional(),
  costo: positiveMoney("El costo debe ser mayor a 0").optional(),
  guia: optionalText,
})

// --- Servientrega ---

export const agregarEnvioACuentaBody = z.object({
  envio_id: id("Envío"),
  year: z.coerce.number({ error: "Envío, año y mes son requeridos" }).int().min(2000, "Año inválido"),
  month: z.coerce
    .number({ error: "Envío, año y mes son requeridos" })
    .int()
    .min(1, "Mes inválido")
    .max(12, "Mes inválido"),
})

export const pagarServientregaBody = z.object({
  cuenta_id: id("Cuenta"),
  monto: positiveMoney("El monto debe ser mayor a 0"),
  metodo: requiredText("Medio de pago y referencia son requeridos"),
  referencia: requiredText("Medio de pago y referencia son requeridos"),
})
