import { withSentryConfig } from "@sentry/nextjs/config"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build portable para el servidor propio (Docker en Oracle Cloud): el
  // Dockerfile define NEXT_OUTPUT=standalone. En Vercel la variable no existe
  // y el build queda igual que siempre.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    // Imágenes de productos, servicios y diseños IA subidas a Vercel Blob.
    // Debe coincidir con OPTIMIZABLE_HOST en lib/images.ts.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sin token no hay subida de source maps (builds locales y previews sin Sentry).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  silent: !process.env.CI,
})
