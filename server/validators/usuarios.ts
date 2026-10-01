import { z } from "zod"
import { normalizarEmail } from "./auth"
import { id, optionalText, requiredText } from "./common"

const REQUERIDOS = "Todos los campos son requeridos"
const PASSWORD_CORTA = "La contraseña debe tener al menos 6 caracteres"

export const crearUsuarioBody = z.object({
  nombre: requiredText(REQUERIDOS),
  email: requiredText(REQUERIDOS).pipe(z.email("Email inválido")).transform(normalizarEmail),
  password: z.string({ error: REQUERIDOS }).min(6, PASSWORD_CORTA),
  rol_id: z.coerce.number({ error: REQUERIDOS }).int().positive(REQUERIDOS),
})
export type CrearUsuario = z.output<typeof crearUsuarioBody>

export const cambiarRolBody = z.object({
  rol_id: z.coerce.number({ error: "Rol requerido" }).int().positive("Rol requerido"),
})

export const resetPasswordBody = z.object({
  nueva_password: z.string({ error: PASSWORD_CORTA }).min(6, PASSWORD_CORTA),
})

export const auditoriaQuery = z.object({
  modulo: z.string().optional(),
  accion: z.string().optional(),
  usuario_id: id("Usuario").optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const ticketsQuery = z.object({ estado: z.string().optional() })

export const crearTicketBody = z.object({
  tipo: requiredText("Faltan campos requeridos").pipe(z.string().max(50, "Tipo inválido")),
  prioridad: requiredText("Faltan campos requeridos").pipe(z.string().max(20, "Prioridad inválida")),
  descripcion: requiredText("Faltan campos requeridos").pipe(z.string().max(5000, "La descripción es demasiado larga")),
  email_contacto: optionalText.pipe(z.string().max(255, "Email inválido").nullable()),
})
