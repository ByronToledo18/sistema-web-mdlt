import { z } from "zod"
import { normalizarEmail } from "./auth"
import { optionalText, requiredText } from "./common"

export const listarClientesQuery = z.object({
  search: z.string().optional(),
  mostrarInactivos: z
    .string()
    .optional()
    .transform((v) => v === "true"),
})

const datosCliente = {
  nombre: requiredText("El nombre es requerido"),
  cedula: optionalText,
  telefono: optionalText,
  // Normalizado (trim + minúsculas) como en el registro: la unicidad y las
  // búsquedas van por lower(email).
  email: optionalText.pipe(z.email("Email inválido").nullable()).transform((v) => (v ? normalizarEmail(v) : v)),
  direccion: optionalText,
  notas: optionalText,
}

export const actualizarClienteBody = z.object(datosCliente)
export type DatosCliente = z.output<typeof actualizarClienteBody>

export const crearClienteBody = z.object({
  ...datosCliente,
  cedula: requiredText("La cédula es requerida"),
})

export const perfilBody = z.object({
  nombre: requiredText("El nombre es requerido"),
  telefono: optionalText,
  direccion: optionalText,
})
