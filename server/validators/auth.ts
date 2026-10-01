import { z } from "zod"
import { optionalText, requiredText } from "./common"

// Validadores de las rutas de autenticación del panel admin y del portal.
//
// Los emails se normalizan (trim + minúsculas) aquí, así los servicios
// guardan y buscan siempre la misma forma.

export const normalizarEmail = (email: string) => email.trim().toLowerCase()

// Solo dígitos, y el prefijo internacional de Ecuador (+593 9...) se lleva a
// la forma local (09...): "+593 99 123 4567" y "0991234567" son el mismo.
export function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "")
  return digitos.startsWith("593") && digitos.length === 12 ? `0${digitos.slice(3)}` : digitos
}

const MIN_PASSWORD = 6
// PBKDF2 acepta cualquier largo, pero no tiene sentido procesar megas.
const MAX_PASSWORD = 256
const PASSWORD_CORTA = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`
const PASSWORD_LARGA = "La contraseña es demasiado larga"

const emailLogin = (message: string) =>
  requiredText(message).pipe(z.string().max(255, "Email inválido")).transform(normalizarEmail)

const passwordNueva = (requerido: string) =>
  z.string({ error: requerido }).min(MIN_PASSWORD, PASSWORD_CORTA).max(MAX_PASSWORD, PASSWORD_LARGA)

const LOGIN_REQUERIDOS = "Email y contraseña son requeridos"

export const loginBody = z.object({
  email: emailLogin(LOGIN_REQUERIDOS),
  password: z.string({ error: LOGIN_REQUERIDOS }).min(1, LOGIN_REQUERIDOS).max(MAX_PASSWORD, PASSWORD_LARGA),
})
export type LoginInput = z.output<typeof loginBody>

const REGISTRO_REQUERIDOS = "Nombre, cédula, email y contraseña son requeridos"

export const registroBody = z.object({
  nombre: requiredText(REGISTRO_REQUERIDOS).pipe(z.string().max(100, "El nombre es demasiado largo")),
  cedula: requiredText(REGISTRO_REQUERIDOS).pipe(z.string().max(20, "Cédula inválida")),
  email: requiredText(REGISTRO_REQUERIDOS)
    .pipe(z.email("Email inválido").max(100, "Email inválido"))
    .transform(normalizarEmail),
  telefono: optionalText.pipe(z.string().max(20, "Teléfono inválido").nullable()),
  direccion: optionalText.pipe(z.string().max(500, "La dirección es demasiado larga").nullable()),
  password: passwordNueva(REGISTRO_REQUERIDOS),
})
export type RegistroInput = z.output<typeof registroBody>

export const recuperarPasswordBody = z.object({
  email: emailLogin("El email es requerido"),
})

const RESET_REQUERIDOS = "Token y nueva contraseña son requeridos"

export const resetPasswordBody = z.object({
  token: requiredText(RESET_REQUERIDOS).pipe(z.string().max(200, "Enlace inválido o ya utilizado")),
  newPassword: passwordNueva(RESET_REQUERIDOS),
})

const CAMBIO_REQUERIDOS = "Contraseña actual y nueva son requeridas"

export const cambiarPasswordBody = z.object({
  currentPassword: z.string({ error: CAMBIO_REQUERIDOS }).min(1, CAMBIO_REQUERIDOS).max(MAX_PASSWORD, PASSWORD_LARGA),
  newPassword: z
    .string({ error: CAMBIO_REQUERIDOS })
    .min(1, CAMBIO_REQUERIDOS)
    .min(MIN_PASSWORD, `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
    .max(MAX_PASSWORD, PASSWORD_LARGA),
})
