// Logger mínimo del servidor.
//
// Escribe en la consola (lo recogen los logs de Vercel) y, además, reenvía cada
// evento a un "sink" opcional registrado con setLogSink() — por ejemplo Sentry,
// conectado desde instrumentation.ts. Así los call sites no dependen de Sentry.
//
// Reglas:
// - `context` identifica el origen: "api/catalogo/pedido POST", "services/pagos".
// - `extra` es para datos estructurados SIN PII ni secretos (ids, estados, conteos).
// - El logging nunca debe romper una ruta: los errores del sink se tragan.
// - Sin APIs de Node: también se usa desde el middleware (Edge).

export type LogContext = string
export type LogExtra = Record<string, unknown>

export interface LogSink {
  error?: (context: LogContext, error: unknown, extra?: LogExtra) => void
  warn?: (context: LogContext, message: string, extra?: LogExtra) => void
  info?: (context: LogContext, message: string, extra?: LogExtra) => void
}

let sink: LogSink | null = null

export function setLogSink(next: LogSink | null) {
  sink = next
}

function serializeExtra(extra?: LogExtra): string {
  if (!extra) return ""
  try {
    return " " + JSON.stringify(extra)
  } catch {
    return " [extra no serializable]"
  }
}

function callSink<K extends keyof LogSink>(method: K, ...args: Parameters<NonNullable<LogSink[K]>>) {
  const fn = sink?.[method] as ((...a: unknown[]) => void) | undefined
  if (!fn) return
  try {
    fn(...args)
  } catch {
    // El sink nunca debe tumbar la petición que está registrando el error.
  }
}

export const logger = {
  error(context: LogContext, error?: unknown, extra?: LogExtra) {
    console.error(`[${context}]${serializeExtra(extra)}`, error ?? "")
    callSink("error", context, error, extra)
  },

  warn(context: LogContext, message: string, extra?: LogExtra) {
    console.warn(`[${context}] ${message}${serializeExtra(extra)}`)
    callSink("warn", context, message, extra)
  },

  info(context: LogContext, message: string, extra?: LogExtra) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[${context}] ${message}${serializeExtra(extra)}`)
    }
    callSink("info", context, message, extra)
  },
}
