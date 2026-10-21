import * as Sentry from "@sentry/nextjs"
import { dataCollection, tracesSampleRate } from "@/lib/sentry-options"

// La integración de Sentry en Vercel solo define NEXT_PUBLIC_SENTRY_DSN (el DSN
// es público). Sin ninguno de los dos el SDK queda desactivado.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Fuera de Vercel (Oracle) el entorno se define con NEXT_PUBLIC_SENTRY_ENVIRONMENT.
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate,
  dataCollection,
})
