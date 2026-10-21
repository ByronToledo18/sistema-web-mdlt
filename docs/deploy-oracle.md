# Despliegue en el servidor propio (Oracle Cloud)

La app corre también en un servidor propio de Oracle Cloud, con una IP de
salida fija que se puede registrar en Servientrega (ver
[ARQUITECTURA.md](../ARQUITECTURA.md), "IP fija"). El despliegue en Vercel
sigue igual ([`deploy-produccion.md`](deploy-produccion.md)): nada de lo que
hay aquí cambia el build de Vercel.

| Fase | Para qué | Dominio | Variables |
|---|---|---|---|
| **1. Pruebas** (actual) | Validar el stack y Servientrega QA desde la IP fija | `149-130-164-213.sslip.io` | Vercel **Preview** (base `mdlt-preview`) + Servientrega QA |
| **2. Producción** | Servir el sitio real | dominio de la tienda | Vercel **Production** (base `mdlt-prod`) + Servientrega prod |

## Servidor

- Oracle Cloud, ARM (aarch64), Ubuntu 22.04, 2 vCPU, 11 GB de RAM, 49 GB de disco.
- IP pública **reservada**: `149.130.164.213`. Es también la IP de **salida**:
  la que se registra en Servientrega.
- Docker 29 + Compose v5; el usuario `ubuntu` está en el grupo `docker`.
- Firewall con 80 y 443 abiertos (persistido).
- Acceso: alias SSH `mdlt` (`ubuntu@149.130.164.213`, llave `~/.ssh/mdlt_oracle`).

## Arquitectura

```
Internet ──► nginx :80  ── /.well-known/acme-challenge ─► webroot (certbot)
         │             └─ resto → 301 https
         └─► nginx :443 (TLS Let's Encrypt, gzip, headers) ──► app:3000 (Next standalone)
                                                                  │
            certbot: certbot renew cada 12 h (webroot)            ├─► Neon (Postgres)
            nginx: nginx -s reload cada 6 h                       ├─► Vercel Blob
                                                                  ├─► Sentry
                                                                  └─► Servientrega (sale por 149.130.164.213)
```

Todo vive en un proyecto de Docker Compose (`-p mdlt`,
[`deploy/oracle/docker-compose.yml`](../deploy/oracle/docker-compose.yml)):

| Servicio | Imagen | Notas |
|---|---|---|
| `app` | `mdlt-app:<sha>` (se construye en el servidor) | Next.js `output: standalone` sobre `node:24-alpine`, usuario `node` (no root), `HEALTHCHECK` sobre `/login`. Solo expuesta a la red interna |
| `nginx` | `nginx:1.27-alpine` | 80/443. Plantilla con `${DOMAIN}`, gzip, HSTS/nosniff/frame/referrer, `client_max_body_size 10m` (uploads de 5 MB), sin buffering (streaming), `X-Forwarded-For` = IP real del cliente |
| `certbot` | `certbot/certbot:v4.2.0` | Renueva por webroot cada 12 h |

Persistencia:

```
~/mdlt/
├── current -> releases/<sha>     release activa
├── previous                      sha de la release anterior
├── releases/<sha>/               las 3 últimas releases (código de git archive)
└── shared/
    ├── .env                      variables de la app (permisos 600)
    └── certbot/{conf,www}/       certificados y webroot
```

- Volumen `mdlt_next_cache` → `/app/.next/cache`: imágenes optimizadas por
  `/_next/image` (`cache/images`) y `fetch-cache`. Sobrevive a los deploys.
  Las páginas ISR regeneradas (p. ej. `/catalogo`) se escriben en
  `.next/server/app` dentro del contenedor: se pierden al recrearlo y Next las
  vuelve a generar (es lo correcto, cada build trae las suyas).
- Rate limiting: sin `KV_REST_API_*` usa el contador en memoria. Con una sola
  instancia es correcto (no hay instancias que no compartan el contador); se
  reinicia con cada deploy.
- Vercel Web Analytics no se carga fuera de Vercel (`app/layout.tsx`).
- Sentry: el entorno se llama como `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (en pruebas,
  `oracle-pruebas`).

### Build y secretos

`next build` necesita la base: `/catalogo` es ISR y se prerenderiza. El
[`Dockerfile`](../Dockerfile) recibe `~/mdlt/shared/.env` como **build
secret** (`RUN --mount=type=secret,id=app_env`), montado como
`.env.production.local`: Next lo carga en el build y no lo copia a
`.next/standalone` (solo copia `.env` y `.env.production`). Existe solo durante
ese `RUN` y no queda en ninguna capa ni en `docker history` (verificado
buscando los valores en el filesystem exportado de la imagen). Las
únicas variables horneadas son las `NEXT_PUBLIC_*` (públicas: van al JS del
navegador), que llegan como build args. `.dockerignore` excluye `.env*`,
`.next`, `node_modules`, `graphify-out`, `tests` y `e2e`.

> BuildKit no invalida la cache por un cambio en el secreto. Si cambias una
> variable que afecta al build y **no** es `NEXT_PUBLIC_*` (p. ej.
> `DATABASE_URL` en el paso a producción), reconstruye sin cache (ver
> "Fase 2").

## Variables (`~/mdlt/shared/.env`)

Formato `CLAVE='valor'` (comillas simples: ni Compose ni Node interpretan `$`
dentro). Se usa a la vez para el contenedor (`env_file`), para el build
(secreto) y para interpolar el compose (`DOMAIN`, `NEXT_PUBLIC_*`).

| Variable | Notas |
|---|---|
| `DOMAIN` | Dominio que sirve nginx y para el que se emite el certificado |
| `NEXT_PUBLIC_APP_URL` | `https://<DOMAIN>`. Enlaces de recuperación de contraseña |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Nombre del entorno en Sentry |
| `LETSENCRYPT_EMAIL` | Opcional: avisos de vencimiento de Let's Encrypt |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN` | Del entorno de Vercel correspondiente |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Sentry (el token sube los source maps en el build) |
| `SERVIENTREGA_*` | Ambiente, credenciales y remitente (ver README) |
| `GEMINI_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Solo existen en Production en Vercel: en la Fase 1 no están (el diseño por IA queda deshabilitado y el rate limiting usa memoria) |

Para armarlo: `npx -y vercel env pull <archivo temporal> --environment=<preview|production> --yes`,
copiar solo las variables de la tabla, subirlo y **borrar el archivo local**:

```bash
ssh mdlt 'umask 077; mkdir -p ~/mdlt/shared && cat > ~/mdlt/shared/.env && chmod 600 ~/mdlt/shared/.env' < archivo.env
rm archivo.env
```

## Deploy

El repo es privado y el servidor no tiene llave de GitHub: el código viaja
desde la PC. Con el commit que quieras publicar en `HEAD`:

```bash
scripts/deploy-oracle.sh
```

1. `git archive HEAD` (solo lo commiteado; los cambios sin commitear no viajan) → `~/mdlt/releases/<sha>`.
2. `docker compose build app` en el servidor (≈ 5–10 min la primera vez; luego usa cache de pnpm y de Next).
3. Cambia `current` a la release nueva y hace `docker compose up -d`.
4. Espera el healthcheck de la app (máx. 3 min). Si no queda sana, **vuelve sola** a la release anterior y termina con error.
5. Si el dominio no tiene certificado, lo emite (`init-letsencrypt.sh`).
6. Verifica `https://<DOMAIN>/login` → 200 desde el propio servidor.
7. Conserva las 3 últimas releases y sus imágenes; borra el resto.

Es idempotente: repetirlo con el mismo commit no sube ni reconstruye nada.

Estado (releases, contenedores, RAM, disco): `scripts/deploy-oracle.sh --status`.

## Certificado

- **Primera emisión** (automática en el primer deploy, o manual):
  `~/mdlt/current/deploy/oracle/init-letsencrypt.sh` (`--staging` para probar
  sin gastar el límite de Let's Encrypt, `--force` para reemitir). Pone un
  certificado autofirmado temporal para que nginx arranque, lo borra y pide el
  real por webroot.
- **Renovación**: automática. `certbot` corre `certbot renew` cada 12 h
  (renueva cuando faltan menos de 30 días) y `nginx` recarga cada 6 h para
  tomar el certificado nuevo. Para comprobarla:

  ```bash
  cd ~/mdlt/current/deploy/oracle && export RELEASE=$(basename "$(readlink ~/mdlt/current)")
  docker compose -p mdlt --env-file ~/mdlt/shared/.env -f docker-compose.yml \
    run --rm --entrypoint certbot certbot renew --dry-run
  ```

## Rollback

```bash
scripts/deploy-oracle.sh --rollback          # a la release anterior (~/mdlt/previous)
scripts/deploy-oracle.sh --rollback <sha>    # a una release concreta (de las 3 guardadas)
```

Apunta `current` a esa release y levanta su imagen `mdlt-app:<sha>` (si se
borró, la reconstruye). No toca la base: si la release nueva aplicó una
migración, el rollback de la base es aparte.

## Migraciones

El deploy **no** corre migraciones. Se aplican desde la PC antes del deploy,
como en Vercel (`deploy-produccion.md`, paso 3), contra la base del entorno.

## Fase 2: producción

1. **DNS**: registro `A` del dominio (y `www` si aplica) → `149.130.164.213`.
   Esperar a que resuelva (`nslookup <dominio>`).
2. **Variables**: rehacer `~/mdlt/shared/.env` con las variables de
   **Production** (`vercel env pull --environment=production`, base
   `mdlt-prod`, `JWT_SECRET` de producción, `GEMINI_API_KEY`, `KV_REST_API_*`),
   `SERVIENTREGA_AMBIENTE='prod'` con sus credenciales, y:

   ```
   DOMAIN='<dominio>'
   NEXT_PUBLIC_APP_URL='https://<dominio>'
   NEXT_PUBLIC_SENTRY_ENVIRONMENT='production'
   ```

   Hacer un backup del `.env` de pruebas antes (`cp .env .env.fase1`, 600).
3. **Servientrega**: la IP que se registra es **`149.130.164.213`** (la IP
   reservada del servidor; las llamadas salen directo, sin
   `SERVIENTREGA_PROXY_URL`).
4. **Build sin cache** (cambió `DATABASE_URL`, que BuildKit no detecta) y
   certificado del dominio nuevo:

   ```bash
   ssh mdlt 'cd ~/mdlt/current/deploy/oracle && export RELEASE=$(basename "$(readlink ~/mdlt/current)") &&
     docker compose -p mdlt --env-file ~/mdlt/shared/.env -f docker-compose.yml build --no-cache app'
   scripts/deploy-oracle.sh     # levanta la app; emite el certificado del dominio nuevo
   ```

   Si el certificado de sslip.io sigue en `shared/certbot/conf`, se puede
   borrar (`certbot delete --cert-name 149-130-164-213.sslip.io`).
5. **Verificar** como en `deploy-produccion.md` ("Verificación posterior") y
   generar una guía real de Servientrega.
6. Recién entonces decidir qué pasa con Vercel Production (dejarlo como
   respaldo o quitarle el dominio).
