# deploy/oracle

Stack de El Mundo de las Tutus en el servidor propio de Oracle Cloud (ARM,
Ubuntu 22.04, Docker + Compose). El procedimiento completo, el rollback y el
paso a producción están en [`docs/deploy-oracle.md`](../../docs/deploy-oracle.md).

| Archivo | Qué es |
|---|---|
| `docker-compose.yml` | `app` (Next standalone, puerto 3000 interno), `nginx` (80/443) y `certbot` (renovación) |
| `nginx/templates/default.conf.template` | Configuración de nginx. `${DOMAIN}` se reemplaza al arrancar (envsubst de la imagen oficial) |
| `init-letsencrypt.sh` | Primera emisión del certificado por webroot (`--staging` para probar) |

## Layout en el servidor

```
~/mdlt/
├── current -> releases/<sha>     release activa (symlink)
├── previous                      sha de la release anterior (para el rollback)
├── releases/<sha>/               código de cada release (git archive), máx. 3
├── shared/
│   ├── .env                      variables de la app (600). NUNCA en el repo
│   └── certbot/{conf,www}/       certificados de Let's Encrypt y webroot
└── tmp/                          paquetes en tránsito
```

Volumen Docker `mdlt_next_cache` → `/app/.next/cache` (imágenes optimizadas y
fetch-cache; sobrevive a los deploys).

## Uso rápido

Desde la PC, en la raíz del repo (Git Bash):

```bash
scripts/deploy-oracle.sh               # despliega HEAD
scripts/deploy-oracle.sh --status      # estado, RAM y disco
scripts/deploy-oracle.sh --rollback    # vuelve a la release anterior
```

Comandos manuales en el servidor (el `RELEASE` debe ser la release activa):

```bash
cd ~/mdlt/current/deploy/oracle
export RELEASE=$(basename "$(readlink ~/mdlt/current)")
alias dc='docker compose -p mdlt --env-file ~/mdlt/shared/.env -f docker-compose.yml'
dc ps
dc logs -f --tail=100 app
dc up -d app          # recrea la app (relee ~/mdlt/shared/.env; restart no lo relee)
```

> Cambiar `~/mdlt/shared/.env` requiere **redeploy** si afecta al build
> (`NEXT_PUBLIC_*`, `DATABASE_URL` para el prerender) y basta con
> `dc up -d app` (recrea el contenedor) para las variables solo de runtime.
