import { z } from "zod"
import { nonNegativeMoney, optionalText, requiredText } from "./common"

export const listarCatalogoQuery = z.object({
  search: z.string().optional(),
  // ?activo=true|false filtra; sin el parámetro se listan todos.
  activo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
})

export const catalogoPublicoQuery = z.object({
  search: z.string().optional(),
  categoria: z.string().optional(),
})

export const productoBody = z.object({
  sku: optionalText,
  nombre: requiredText("Nombre y precio son requeridos"),
  precio: nonNegativeMoney("El precio no puede ser negativo"),
  stock: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce
      .number({ error: "Stock inválido" })
      .int("Stock inválido")
      .min(0, "El stock no puede ser negativo")
      .optional(),
  ),
  activo: z
    .boolean()
    .optional()
    .transform((v) => v !== false),
  imagen_url: optionalText,
  // Sin el campo, grava IVA (los precios del catálogo no lo incluyen).
  graba_iva: z
    .boolean()
    .optional()
    .transform((v) => v !== false),
})
export type DatosProducto = z.output<typeof productoBody>

export const servicioBody = z.object({
  nombre: requiredText("Nombre y precio base son requeridos"),
  unidad: optionalText,
  precio_base: nonNegativeMoney("El precio no puede ser negativo"),
  variable: z
    .boolean()
    .optional()
    .transform((v) => v === true),
  activo: z
    .boolean()
    .optional()
    .transform((v) => v !== false),
  imagen_url: optionalText,
  graba_iva: z
    .boolean()
    .optional()
    .transform((v) => v !== false),
})
export type DatosServicio = z.output<typeof servicioBody>
