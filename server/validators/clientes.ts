import { z } from "zod"
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
  email: optionalText.pipe(z.email("Email inválido").nullable()),
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
