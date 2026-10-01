import * as Sentry from "@sentry/nextjs"
import { setLogSink } from "@/lib/logger"
import { sentryLogSink } from "@/lib/sentry-sink"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }

  // logger.error / logger.warn también llegan a Sentry.
  setLogSink(sentryLogSink)
}

// Errores no capturados en Server Components, route handlers y middleware.
export const onRequestError = Sentry.captureRequestError
