import { z } from "zod"
import { id, isoDate, nonNegativeMoney, optionalText, positiveMoney, requiredText } from "./common"

export const listarProveedoresQuery = z.object({
  search: z.string().optional(),
  mostrarInactivos: z
    .string()
    .optional()
    .transform((v) => v === "true"),
})

export const proveedorBody = z.object({
  nombre: requiredText("El nombre es requerido"),
  ruc: optionalText,
  telefono: optionalText,
  email: optionalText,
  direccion: optionalText,
  contacto_nombre: optionalText,
  contacto_telefono: optionalText,
  notas: optionalText,
})
export type DatosProveedor = z.output<typeof proveedorBody>

export const facturaParams = z.object({ facturaId: id("Factura") })

export const listarFacturasQuery = z.object({ estado: z.string().optional() })

export const crearFacturaBody = z.object({
  numero_factura: requiredText("Datos incompletos"),
  fecha_emision: isoDate("Datos incompletos"),
  fecha_vencimiento: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(isoDate("Fecha de vencimiento inválida").nullable()),
  notas: optionalText,
  items: z
    .array(
      z
        .object({
          // La UI manda null (o 0) cuando el ítem no es un producto del inventario.
          producto_id: z.preprocess((v) => (v ? v : null), id("Producto").nullable()),
          descripcion: requiredText("Cada ítem necesita una descripción"),
          cantidad: positiveMoney("La cantidad debe ser mayor a 0"),
          precio_unitario: nonNegativeMoney("El precio no puede ser negativo"),
        })
        .refine(
          (item) => item.producto_id === null || Number.isInteger(item.cantidad),
          "La cantidad de un producto del inventario debe ser un número entero",
        ),
      { error: "Datos incompletos" },
    )
    .min(1, "Datos incompletos"),
})
export type CrearFacturaProveedor = z.output<typeof crearFacturaBody>

export const pagoFacturaBody = z.object({
  monto: positiveMoney("El monto debe ser mayor a 0"),
  metodo: optionalText,
  referencia: optionalText,
  observacion: optionalText,
})
export type PagoFacturaProveedor = z.output<typeof pagoFacturaBody>
