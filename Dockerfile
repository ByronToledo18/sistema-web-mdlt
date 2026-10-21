# syntax=docker/dockerfile:1.7
#
# Imagen de producción para el servidor propio (Oracle Cloud, linux/arm64).
# Ver docs/deploy-oracle.md. En Vercel este archivo no se usa.
#
# Secretos: el build de Next necesita la base (/catalogo es ISR y se
# prerenderiza), así que lee el .env del servidor como *build secret*
# (RUN --mount=type=secret): se monta solo durante ese RUN y no queda en
# ninguna capa. Las únicas variables que se hornean son las NEXT_PUBLIC_*,
# que son públicas (van en el JS del navegador) y llegan como build args.

ARG NODE_IMAGE=node:24-alpine

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
# pnpm fijo: Corepack no es fiable en todos los entornos del proyecto.
RUN npm install -g pnpm@11.24.0 && npm cache clean --force
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencias (incluye las de desarrollo: TypeScript, Tailwind… las usa el build).
# sharp trae su binario prebuilt para linux-arm64 (musl) vía @img/sharp-*.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=mdlt-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Públicas: se incrustan en el bundle del navegador.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT} \
    NEXT_OUTPUT=standalone

# El resto (DATABASE_URL, JWT_SECRET, SENTRY_AUTH_TOKEN…) solo existe dentro
# de este RUN: node --env-file lo carga sin pasar por el shell (los valores no
# se interpretan) y las variables ya definidas arriba tienen prioridad.
RUN --mount=type=secret,id=app_env,required=true \
    --mount=type=cache,id=mdlt-next-build-cache,target=/app/.next/cache \
    node --env-file=/run/secrets/app_env node_modules/next/dist/bin/next build

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios (uid 1000 "node", ya incluido en la imagen oficial).
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# .next/cache (imágenes optimizadas en cache/images y fetch-cache) se monta como
# volumen persistente; se crea aquí para que el volumen herede el dueño.
RUN mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000

# /login es estática y no toca la base: el healthcheck no despierta Neon.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
