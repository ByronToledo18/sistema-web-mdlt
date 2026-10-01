import { z } from "zod"
import { NOMINA_TIPOS } from "@/server/db/schema"
import { isoDate, positiveMoney, requiredText } from "./common"

const REQUERIDOS = "Persona, concepto, fecha y tipo son requeridos"

export const nominaQuery = z.object({
  vista: z.string().optional(),
  persona_tipo: z.string().optional(),
  tipo: z.enum(NOMINA_TIPOS, { error: "Tipo inválido" }).optional(),
  fecha_desde: isoDate("Fecha inválida").optional(),
  fecha_hasta: isoDate("Fecha inválida").optional(),
})
export type FiltrosNomina = z.output<typeof nominaQuery>

export const registrarMovimientoBody = z.object({
  persona_tipo: requiredText(REQUERIDOS),
  concepto: requiredText(REQUERIDOS),
  fecha: isoDate(REQUERIDOS),
  tipo: z.enum(NOMINA_TIPOS, { error: "Tipo inválido" }),
  monto: positiveMoney("El monto debe ser mayor a 0"),
  pedido_id: z.preprocess(
    (v) => (v ? v : null),
    z.coerce.number({ error: "Pedido inválido" }).int().positive("Pedido inválido").nullable(),
  ),
})
export type RegistrarMovimiento = z.output<typeof registrarMovimientoBody>
