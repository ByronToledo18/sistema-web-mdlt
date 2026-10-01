import type { NextRequest } from "next/server"
import { z } from "zod"
import { HttpError } from "@/lib/http"

// Un ZodError que salga de estas funciones lo convierte routeError() en un 400
// con el primer mensaje, así que los mensajes van en español y pensados para
// mostrarse tal cual en la UI.

export const id = (label = "ID") =>
  z.coerce
    .number({ error: `${label} inválido` })
    .int(`${label} inválido`)
    .positive(`${label} inválido`)

export const idParams = z.object({ id: id() })

// Texto opcional: "" y null se guardan como null (lo que hacía `x || null`).
export const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))

export const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message)

// Número que puede llegar como number o como string de un <input>. null y ""
// cuentan como "falta" (z.coerce los convertiría en 0), y NaN serializado por
// JSON.stringify llega como null.
const numberInput = (message: string) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number({ error: message }))

export const positiveMoney = (message: string) =>
  numberInput(message).refine((n) => Number.isFinite(n) && n > 0, message)

export const nonNegativeMoney = (message: string) =>
  numberInput(message).refine((n) => Number.isFinite(n) && n >= 0, message)

// ?page= de los listados del admin: entero desde 1; cualquier otra cosa es 1.
const paginaSchema = z.coerce.number().int().min(1).max(100_000).catch(1)
export function numeroDePagina(valor: string | string[] | undefined): number {
  return paginaSchema.parse(Array.isArray(valor) ? valor[0] : (valor ?? 1))
}

// "YYYY-MM-DD"
export const isoDate = (message: string) => z.string({ error: message }).regex(/^\d{4}-\d{2}-\d{2}/, message)

export async function parseBody<T extends z.ZodType>(request: NextRequest | Request, schema: T): Promise<z.output<T>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new HttpError(400, "El cuerpo de la petición no es JSON válido")
  }
  return schema.parse(body)
}

export async function parseParams<T extends z.ZodType>(params: Promise<unknown>, schema: T): Promise<z.output<T>> {
  const parsed = schema.safeParse(await params)
  if (!parsed.success) {
    // Un id de ruta mal formado es un recurso que no existe.
    throw new HttpError(404, "No encontrado")
  }
  return parsed.data
}

export function parseQuery<T extends z.ZodType>(request: NextRequest | Request, schema: T): z.output<T> {
  const searchParams = new URL(request.url).searchParams
  const raw: Record<string, string> = {}
  for (const [key, value] of searchParams) {
    if (value !== "") raw[key] = value
  }
  return schema.parse(raw)
}
