import * as Sentry from "@sentry/nextjs"
import { dataCollection, tracesSampleRate } from "@/lib/sentry-options"

// Sin SENTRY_DSN (desarrollo local) el SDK queda desactivado.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate,
  dataCollection,
})
