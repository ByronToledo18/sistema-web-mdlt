import * as Sentry from "@sentry/nextjs"
import { dataCollection, tracesSampleRate } from "@/lib/sentry-options"

// Sin NEXT_PUBLIC_SENTRY_DSN (desarrollo local) el SDK queda desactivado.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // Fuera de Vercel (Oracle) el entorno se define con NEXT_PUBLIC_SENTRY_ENVIRONMENT.
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate,
  dataCollection,
  // Ruido conocido del navegador; ya se silencia en ResizeObserverErrorSuppressor.
  ignoreErrors: ["ResizeObserver loop"],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
