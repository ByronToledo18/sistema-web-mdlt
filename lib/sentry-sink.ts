import * as Sentry from "@sentry/nextjs"
import type { LogSink } from "@/lib/logger"

// Reenvía a Sentry los errores y advertencias de lib/logger.ts. info no se
// envía, para no gastar cuota. Se registra en instrumentation.ts.
export const sentryLogSink: LogSink = {
  error(context, error, extra) {
    Sentry.captureException(error, { tags: { context }, extra })
  },
  warn(context, message, extra) {
    Sentry.captureMessage(`[${context}] ${message}`, { level: "warning", extra })
  },
}
