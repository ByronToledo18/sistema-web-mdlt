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

// Tipos de ticket. "reseteo_contraseña" lo crean solo los flujos de
// recuperación del servidor (solicitarReseteoCliente en portal-auth.ts y
// solicitarReseteoAdmin en usuarios.ts): esos tickets llevan enlaces de
// reseteo y soporte confía en ellos, así que el POST público no puede crearlos.
export const TIPOS_TICKET_PUBLICOS = ["soporte_tecnico", "consulta", "otro"] as const
export type TipoTicket = (typeof TIPOS_TICKET_PUBLICOS)[number] | "reseteo_contraseña"
export const PRIORIDADES_TICKET = ["baja", "media", "alta"] as const
export type PrioridadTicket = (typeof PRIORIDADES_TICKET)[number]

// POST público /api/soporte/tickets.
export const crearTicketBody = z.object({
  tipo: z.enum(TIPOS_TICKET_PUBLICOS, { error: "Tipo de ticket inválido" }),
  prioridad: z.enum(PRIORIDADES_TICKET, { error: "Prioridad inválida" }).default("media"),
  descripcion: requiredText("La descripción es requerida").pipe(
    z.string().max(2000, "La descripción es demasiado larga"),
  ),
  email_contacto: optionalText.pipe(z.email("Email inválido").max(255, "Email inválido").nullable()),
})

// "Olvidé mi contraseña" del login del panel admin.
export const solicitarReseteoAdminBody = z.object({
  email: requiredText("El email es requerido")
    .pipe(z.email("Email inválido").max(255, "Email inválido"))
    .transform(normalizarEmail),
  mensaje: optionalText.pipe(z.string().max(1000, "El mensaje es demasiado largo").nullable()),
})
