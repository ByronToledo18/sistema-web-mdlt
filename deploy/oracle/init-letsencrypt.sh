#!/usr/bin/env bash
# Primera emisión del certificado de Let's Encrypt (webroot) para ${DOMAIN}.
# Se corre EN EL SERVIDOR, una vez por dominio (scripts/deploy-oracle.sh lo
# llama solo si todavía no hay certificado). Después, el servicio certbot del
# compose renueva solo y nginx recarga cada 6 h.
#
# Uso:  ~/mdlt/current/deploy/oracle/init-letsencrypt.sh [--staging] [--force]
#   --staging  usa el entorno de pruebas de Let's Encrypt (sin rate limits)
#   --force    reemite aunque ya exista un certificado real
#
# Lee DOMAIN y, opcional, LETSENCRYPT_EMAIL de ~/mdlt/shared/.env.
set -euo pipefail

MDLT_HOME="${MDLT_HOME:-$HOME/mdlt}"
ENV_FILE="$MDLT_HOME/shared/.env"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGING=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --staging) STAGING=1 ;;
    --force) FORCE=1 ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

# Lee una variable del .env sin cargar el archivo entero en el shell.
leer_env() {
  local v
  v="$(grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  v="${v%\'}"; v="${v#\'}"; v="${v%\"}"; v="${v#\"}"
  printf '%s' "$v"
}

DOMAIN="$(leer_env DOMAIN)"
EMAIL="$(leer_env LETSENCRYPT_EMAIL)"
[ -n "$DOMAIN" ] || { echo "Falta DOMAIN en $ENV_FILE" >&2; exit 1; }

export MDLT_HOME
export RELEASE="${RELEASE:-$(basename "$(readlink -f "$HERE/../..")")}"
compose() { docker compose -p mdlt --env-file "$ENV_FILE" -f "$HERE/docker-compose.yml" "$@"; }

CONF="$MDLT_HOME/shared/certbot/conf"
LIVE="$CONF/live/$DOMAIN"
mkdir -p "$CONF" "$MDLT_HOME/shared/certbot/www"

# El certificado real es un symlink a archive/ (700, de root): se comprueba con
# -L, que no necesita leer el destino. El temporal es un archivo normal.
if [ -L "$LIVE/fullchain.pem" ] && [ ! -e "$LIVE/.dummy" ] && [ "$FORCE" -eq 0 ]; then
  echo "Ya existe un certificado para $DOMAIN (usa --force para reemitir)."
  exit 0
fi

# Las opciones TLS recomendadas de certbot no se usan: nginx define las suyas.

echo "==> Certificado temporal autofirmado para que nginx arranque"
compose run --rm --no-deps --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj /CN=localhost >/dev/null 2>&1 &&
  touch /etc/letsencrypt/live/$DOMAIN/.dummy"

echo "==> Levantando nginx"
compose up -d nginx
# Si nginx ya corría con otro certificado, que lea el temporal.
compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true

echo "==> Borrando el certificado temporal"
compose run --rm --no-deps --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf"

echo "==> Solicitando el certificado a Let's Encrypt para $DOMAIN"
args=(certonly --webroot -w /var/www/certbot -d "$DOMAIN" --rsa-key-size 4096 --agree-tos --non-interactive)
if [ -n "$EMAIL" ]; then args+=(--email "$EMAIL"); else args+=(--register-unsafely-without-email); fi
[ "$STAGING" -eq 1 ] && args+=(--staging)
compose run --rm --no-deps --entrypoint certbot certbot "${args[@]}"

echo "==> Recargando nginx"
compose exec -T nginx nginx -s reload
echo "Listo: https://$DOMAIN"
