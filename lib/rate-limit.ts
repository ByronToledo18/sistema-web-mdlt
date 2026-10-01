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
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Upstash respondió ${res.status}`)
  }
  const [incr, , ttl] = (await res.json()) as { result: number }[]
  return { count: incr.result, ttl: ttl.result > 0 ? ttl.result : windowSec }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown"
}

export async function rateLimit(request: NextRequest, opts: RateLimitOptions): Promise<RateLimitResult> {
  const key = `rl:${opts.key}:${getClientIp(request)}${opts.id ? `:${opts.id.toLowerCase()}` : ""}`

  let hit: { count: number; ttl: number }
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      hit = await redisHit(key, opts.windowSec)
    } catch (error) {
      // Si Redis falla no se bloquea el login de todos: se cae al contador local.
      logger.error("rate-limit", error, { fallback: "memoria" })
      hit = memoryHit(key, opts.windowSec)
    }
  } else {
    hit = memoryHit(key, opts.windowSec)
  }

  return { success: hit.count <= opts.limit, retryAfter: hit.ttl }
}

export function rateLimitResponse(retryAfter: number) {
  const minutos = Math.max(1, Math.ceil(retryAfter / 60))
  return NextResponse.json(
    { error: `Demasiados intentos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )
}

// Límites por endpoint, en un solo lugar para poder ajustarlos.
export const RATE_LIMITS = {
  adminLogin: { key: "auth-login", limit: 10, windowSec: 15 * 60 },
  portalLogin: { key: "portal-login", limit: 10, windowSec: 15 * 60 },
  portalRegistro: { key: "portal-registro", limit: 5, windowSec: 60 * 60 },
  recuperarPassword: { key: "portal-recuperar", limit: 5, windowSec: 15 * 60 },
  resetPassword: { key: "portal-reset", limit: 10, windowSec: 15 * 60 },
  disenar: { key: "catalogo-disenar", limit: 10, windowSec: 60 * 60 },
} satisfies Record<string, Omit<RateLimitOptions, "id">>
