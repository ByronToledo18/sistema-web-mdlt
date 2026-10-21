import "server-only"

import { z } from "zod"
import { PRODUCTO_SERVIENTREGA_IDS } from "@/lib/servientrega"
import type { ConfigServientrega } from "./config"

// Input interno de una guía (lo que arma server/services/servientrega.ts) y su
// conversión al JSON que espera POST /api/guiawebs/. La API documenta los
// nombres en MAYÚSCULAS pero su ejemplo y QA usan minúsculas.

const texto = (campo: string, max: number) =>
  z
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(1, `${campo} es obligatorio`)
    .max(max, `${campo} admite hasta ${max} caracteres`)

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v ?? "")

const parte = (quien: string) =>
  z.object({
    identificacion: texto(`Identificación del ${quien}`, 20),
    razon_social: texto(`Razón social del ${quien}`, 100),
    nombre: texto(`Nombre del ${quien}`, 100),
    apellido: texto(`Apellido del ${quien}`, 100),
    direccion: texto(`Dirección del ${quien}`, 200),
    sector: opcional(100),
    telefono: texto(`Teléfono del ${quien}`, 20),
  })

export const guiaInputSchema = z.object({
  ciudad_origen_id: z.number().int().positive("Ciudad de origen inválida"),
  ciudad_destino_id: z.number().int().positive("Ciudad de destino inválida"),
  remitente: parte("remitente"),
  destinatario: parte("destinatario"),
  producto_id: z
    .number()
    .int()
    .refine((v) => (PRODUCTO_SERVIENTREGA_IDS as number[]).includes(v), "Producto de Servientrega inválido"),
  contenido: texto("Contenido", 100),
  piezas: z.number().int("Piezas debe ser un entero").min(1, "Al menos 1 pieza").max(99, "Máximo 99 piezas"),
  peso_kg: z.number().positive("El peso debe ser mayor a 0").max(500, "Peso máximo 500 kg"),
  valor_mercancia: z.number().min(0, "El valor de la mercancía no puede ser negativo"),
  valor_asegurado: z.number().min(0).default(0),
  // Referencias que se imprimen en la guía (código del pedido, guía interna).
  referencia_1: opcional(100),
  referencia_2: opcional(100),
})

export type GuiaInput = z.input<typeof guiaInputSchema>

const dosDecimales = (n: number) => Math.round(n * 100) / 100

export type PayloadGuia = ReturnType<typeof mapearGuia>

export function mapearGuia(input: GuiaInput, credenciales: Pick<ConfigServientrega, "usuario" | "password">) {
  const g = guiaInputSchema.parse(input)
  return {
    id_tipo_logistica: 1,
    detalle_envio_1: g.referencia_1,
    detalle_envio_2: g.referencia_2,
    detalle_envio_3: "",
    id_ciudad_origen: g.ciudad_origen_id,
    id_ciudad_destino: g.ciudad_destino_id,
    id_destinatario_ne_cl: g.destinatario.identificacion,
    razon_social_desti_ne: g.destinatario.razon_social,
    nombre_destinatario_ne: g.destinatario.nombre,
    apellido_destinatar_ne: g.destinatario.apellido,
    direccion1_destinat_ne: g.destinatario.direccion,
    sector_destinat_ne: g.destinatario.sector,
    telefono1_destinat_ne: g.destinatario.telefono,
    telefono2_destinat_ne: "",
    codigo_postal_dest_ne: "",
    id_remitente_cl: g.remitente.identificacion,
    razon_social_remite: g.remitente.razon_social,
    nombre_remitente: g.remitente.nombre,
    apellido_remite: g.remitente.apellido,
    direccion1_remite: g.remitente.direccion,
    sector_remite: g.remitente.sector,
    telefono1_remite: g.remitente.telefono,
    telefono2_remite: "",
    codigo_postal_remi: "",
    id_producto: g.producto_id,
    contenido: g.contenido,
    numero_piezas: g.piezas,
    valor_mercancia: dosDecimales(g.valor_mercancia),
    valor_asegurado: dosDecimales(g.valor_asegurado),
    largo: 0,
    ancho: 0,
    alto: 0,
    peso_fisico: dosDecimales(g.peso_kg),
    login_creacion: credenciales.usuario,
    password: credenciales.password,
  }
}
