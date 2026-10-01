import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/lib/logger"

// Rate limiting de ventana fija.
//
// En producción usa Upstash Redis (Vercel Marketplace) por su API REST, así
// el contador se comparte entre todas las instancias serverless. Acepta las
// variables que crea la integración de Vercel (KV_REST_API_*) o las de
// Upstash (UPSTASH_REDIS_REST_*).
//
// Sin esas variables cae a un contador en memoria: sirve para desarrollo,
// pero en serverless cada instancia tiene su propio contador, así que en
// producción hay que configurar Redis.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

if (!REDIS_URL && process.env.NODE_ENV === "production") {
  logger.warn("rate-limit", "Redis no configurado: se usa un contador en memoria por instancia")
}

export interface RateLimitOptions {
  // Prefijo que identifica el endpoint, p. ej. "auth-login"
  key: string
  limit: number
  windowSec: number
  // Identificador adicional (email, id de cliente). Por defecto solo la IP.
  id?: string
}

interface RateLimitResult {
  success: boolean
  retryAfter: number
}

const memory = new Map<string, { count: number; resetAt: number }>()

function memoryHit(key: string, windowSec: number): { count: number; ttl: number } {
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k)
    }
    return { count: 1, ttl: windowSec }
  }
  entry.count++
  return { count: entry.count, ttl: Math.ceil((entry.resetAt - now) / 1000) }
}

async function redisHit(key: string, windowSec: number): Promise<{ count: number; ttl: number }> {
  const [incr, , ttl] = await redisPipeline([
    ["INCR", key],
    ["EXPIRE", key, String(windowSec), "NX"],
    ["TTL", key],
  ])
  return {
    count: Number(incr.result),
    ttl: Number(ttl.result) > 0 ? Number(ttl.result) : windowSec,
  }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown"
}

export async function rateLimit(request: NextRequest, opts: RateLimitOptions): Promise<RateLimitResult> {
  return contar(`rl:${opts.key}:${getClientIp(request)}${opts.id ? `:${opts.id.toLowerCase()}` : ""}`, opts)
}

// Límite de FALLOS por cuenta (email normalizado o id de usuario), sin
// importar la IP: frena el password spraying contra una cuenta desde muchas
// IPs, que el límite por IP no ve. Se aplica además del límite por IP.
//
// A diferencia de rateLimit, no cuenta cada petición: si contara todos los
// intentos, cualquiera podría bloquear al dueño legítimo con unos pocos POST
// (DoS de cuenta). La semántica es:
//   1. antes de verificar la contraseña solo se CONSULTA el contador;
//   2. se incrementa solo tras un intento fallido;
//   3. un intento correcto lo resetea.
// Ventana fija: el primer fallo abre la ventana de `windowSec`.
export interface LimiteFallos {
  // Bloqueado: ya se alcanzó el límite de fallos en la ventana.
  bloqueado: boolean
  retryAfter: number
}

export async function consultarFallos(opts: Omit<RateLimitOptions, "id">, cuenta: string): Promise<LimiteFallos> {
  const { count, ttl } = await conRedis(
    () => redisGet(claveFallos(opts.key, cuenta)),
    () => memoryGet(claveFallos(opts.key, cuenta)),
  )
  return {
    bloqueado: count >= opts.limit,
    retryAfter: ttl > 0 ? ttl : opts.windowSec,
  }
}

export async function registrarFallo(opts: Omit<RateLimitOptions, "id">, cuenta: string): Promise<void> {
  const key = claveFallos(opts.key, cuenta)
  await conRedis(
    () => redisHit(key, opts.windowSec),
    () => memoryHit(key, opts.windowSec),
  )
}

export async function resetearFallos(opts: Omit<RateLimitOptions, "id">, cuenta: string): Promise<void> {
  const key = claveFallos(opts.key, cuenta)
  await conRedis(
    () => redisDel(key),
    () => {
      memory.delete(key)
    },
  )
}

// Envuelve un intento (login, cambio de contraseña) con el límite de fallos.
// `fallo` decide si el resultado cuenta como fallo; si `intento` lanza, se
// cuenta como fallo solo cuando `falloError` lo indica (p. ej. "contraseña
// actual incorrecta") y el error se relanza.
export async function conLimiteFallos<T>(
  opts: Omit<RateLimitOptions, "id">,
  cuenta: string,
  intento: () => Promise<T>,
  {
    fallo = () => false,
    falloError = () => false,
  }: {
    fallo?: (resultado: T) => boolean
    falloError?: (error: unknown) => boolean
  } = {},
): Promise<{ bloqueado: true; retryAfter: number } | { bloqueado: false; resultado: T }> {
  const estado = await consultarFallos(opts, cuenta)
  if (estado.bloqueado) return { bloqueado: true, retryAfter: estado.retryAfter }

  let resultado: T
  try {
    resultado = await intento()
  } catch (error) {
    if (falloError(error)) await registrarFallo(opts, cuenta)
    throw error
  }
  if (fallo(resultado)) await registrarFallo(opts, cuenta)
  else await resetearFallos(opts, cuenta)
  return { bloqueado: false, resultado }
}

function claveFallos(key: string, cuenta: string): string {
  return `rl:${key}:fallos:${cuenta.trim().toLowerCase()}`
}

function memoryGet(key: string): { count: number; ttl: number } {
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || entry.resetAt <= now) return { count: 0, ttl: 0 }
  return { count: entry.count, ttl: Math.ceil((entry.resetAt - now) / 1000) }
}

async function redisPipeline(comandos: string[][]): Promise<{ result: number | string | null }[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comandos),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Upstash respondió ${res.status}`)
  }
  return (await res.json()) as { result: number | string | null }[]
}

async function redisGet(key: string): Promise<{ count: number; ttl: number }> {
  const [get, ttl] = await redisPipeline([
    ["GET", key],
    ["TTL", key],
  ])
  return {
    count: Number(get.result ?? 0) || 0,
    ttl: Number(ttl.result) > 0 ? Number(ttl.result) : 0,
  }
}

async function redisDel(key: string): Promise<void> {
  await redisPipeline([["DEL", key]])
}

// Usa Redis si está configurado; si falla, el contador local (no se bloquea
// el login de todos por una caída de Redis).
async function conRedis<T>(redis: () => Promise<T>, local: () => T): Promise<T> {
  if (!REDIS_URL || !REDIS_TOKEN) return local()
  try {
    return await redis()
  } catch (error) {
    logger.error("rate-limit", error, { fallback: "memoria" })
    return local()
  }
}

async function contar(key: string, opts: { limit: number; windowSec: number }): Promise<RateLimitResult> {
  const hit = await conRedis(
    () => redisHit(key, opts.windowSec),
    () => memoryHit(key, opts.windowSec),
  )
  return { success: hit.count <= opts.limit, retryAfter: hit.ttl }
}

export function rateLimitResponse(retryAfter: number) {
  const minutos = Math.max(1, Math.ceil(retryAfter / 60))
  return NextResponse.json(
    {
      error: `Demasiados intentos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )
}

// Límites por endpoint, en un solo lugar para poder ajustarlos.
export const RATE_LIMITS = {
  adminLogin: { key: "auth-login", limit: 10, windowSec: 15 * 60 },
  portalLogin: { key: "portal-login", limit: 10, windowSec: 15 * 60 },
  // Por cuenta (conLimiteFallos): logins FALLIDOS contra un mismo email desde
  // cualquier IP. Solo cuentan los fallos y un login correcto resetea.
  adminLoginCuenta: { key: "auth-login", limit: 20, windowSec: 60 * 60 },
  portalLoginCuenta: { key: "portal-login", limit: 20, windowSec: 60 * 60 },
  // Por usuario/cliente (conLimiteFallos): cambios de contraseña con la
  // contraseña actual incorrecta.
  adminCambioPassword: {
    key: "auth-cambio-password",
    limit: 10,
    windowSec: 60 * 60,
  },
  portalCambioPassword: {
    key: "portal-cambio-password",
    limit: 10,
    windowSec: 60 * 60,
  },
  portalRegistro: { key: "portal-registro", limit: 5, windowSec: 60 * 60 },
  recuperarPassword: { key: "portal-recuperar", limit: 5, windowSec: 15 * 60 },
  resetPassword: { key: "portal-reset", limit: 10, windowSec: 15 * 60 },
  disenar: { key: "catalogo-disenar", limit: 10, windowSec: 60 * 60 },
  soporteTicket: { key: "soporte-ticket", limit: 5, windowSec: 60 * 60 },
  reseteoAdmin: { key: "auth-reseteo", limit: 5, windowSec: 15 * 60 },
} satisfies Record<string, Omit<RateLimitOptions, "id">>
