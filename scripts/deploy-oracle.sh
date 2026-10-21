#!/usr/bin/env bash
# Deploy de El Mundo de las Tutus al servidor propio (Oracle Cloud) sin GitHub.
# Ver docs/deploy-oracle.md.
#
# Desde la PC (Git Bash / Linux / macOS), en la raíz del repo:
#
#   scripts/deploy-oracle.sh              despliega el commit actual (HEAD)
#   scripts/deploy-oracle.sh --rollback   vuelve a la release anterior
#   scripts/deploy-oracle.sh --rollback <sha>   vuelve a una release concreta
#   scripts/deploy-oracle.sh --status     muestra releases, contenedores y salud
#
# Qué hace un deploy:
#   1. git archive HEAD → tar.gz (solo lo commiteado; nunca .env ni node_modules).
#   2. Lo sube a ~/mdlt/releases/<sha> (si ya está, no lo vuelve a subir).
#   3. En el servidor: docker compose build (el .env entra como build secret),
#      cambia el symlink ~/mdlt/current, docker compose up -d y espera el
#      healthcheck. Si la app no queda sana, vuelve sola a la release anterior.
#   4. Si el dominio todavía no tiene certificado, lo emite (webroot).
#   5. Conserva las 3 últimas releases (y sus imágenes) y borra el resto.
#
# El .env del servidor vive en ~/mdlt/shared/.env (600) y no viaja nunca.
# Es idempotente: repetirlo con el mismo commit no cambia nada.
#
# Variables opcionales: MDLT_SSH (alias SSH, por defecto "mdlt").
set -euo pipefail

SSH_HOST="${MDLT_SSH:-mdlt}"
ACCION="deploy"
OBJETIVO=""
case "${1:-}" in
  "") ;;
  --rollback) ACCION="rollback"; OBJETIVO="${2:-}" ;;
  --status) ACCION="status" ;;
  -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
  *) echo "Uso: $0 [--rollback [sha] | --status]" >&2; exit 2 ;;
esac

# --------------------------------------------------------------------------
# Script que corre en el servidor (bash -s). Recibe: acción, sha.
# --------------------------------------------------------------------------
remoto() {
cat <<'REMOTO'
set -euo pipefail
ACCION="$1"; SHA="${2:-}"
MDLT_HOME="$HOME/mdlt"
ENV_FILE="$MDLT_HOME/shared/.env"
RELEASES="$MDLT_HOME/releases"
CONSERVAR=3
export MDLT_HOME

log() { printf '\n==> %s\n' "$*"; }
falla() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

compose() {
  local rel="$1"; shift
  RELEASE="$rel" docker compose -p mdlt --env-file "$ENV_FILE" \
    -f "$RELEASES/$rel/deploy/oracle/docker-compose.yml" "$@"
}

actual() { [ -L "$MDLT_HOME/current" ] && basename "$(readlink "$MDLT_HOME/current")" || true; }

apuntar() { # cambia el symlink current de forma atómica
  ln -sfn "releases/$1" "$MDLT_HOME/current.tmp"
  mv -Tf "$MDLT_HOME/current.tmp" "$MDLT_HOME/current"
}

leer_env() {
  local v; v="$(grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  v="${v%\'}"; v="${v#\'}"; v="${v%\"}"; v="${v#\"}"; printf '%s' "$v"
}

esperar_sano() { # espera el healthcheck de la app (máx. 3 min)
  local rel="$1" id estado i
  for i in $(seq 1 60); do
    id="$(compose "$rel" ps -q app 2>/dev/null || true)"
    estado="$( [ -n "$id" ] && docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)"
    [ "$estado" = "healthy" ] && return 0
    [ "$estado" = "unhealthy" ] && return 1
    sleep 3
  done
  return 1
}

levantar() { # levanta la release $1 (nginx solo si ya hay certificado)
  local rel="$1" dominio
  dominio="$(leer_env DOMAIN)"
  compose "$rel" up -d --remove-orphans app certbot
  esperar_sano "$rel" || return 1
  if [ -f "$MDLT_HOME/shared/certbot/conf/live/$dominio/fullchain.pem" ]; then
    compose "$rel" up -d --remove-orphans nginx
  else
    log "No hay certificado para $dominio: primera emisión"
    RELEASE="$rel" bash "$RELEASES/$rel/deploy/oracle/init-letsencrypt.sh"
  fi
}

verificar_https() {
  local dominio code
  dominio="$(leer_env DOMAIN)"
  for i in $(seq 1 10); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --resolve "$dominio:443:127.0.0.1" "https://$dominio/login" || true)"
    [ "$code" = "200" ] && { echo "https://$dominio/login → 200"; return 0; }
    sleep 2
  done
  echo "https://$dominio/login → $code" >&2
  return 1
}

limpiar() { # conserva las $CONSERVAR releases más recientes (+ la actual)
  local cur rel n=0
  cur="$(actual)"
  for dir in $(ls -1dt "$RELEASES"/*/ 2>/dev/null | grep -v '\.tmp/$'); do
    rel="$(basename "$dir")"
    n=$((n + 1))
    if [ "$n" -le "$CONSERVAR" ] || [ "$rel" = "$cur" ]; then continue; fi
    echo "Borrando release $rel"
    rm -rf "${RELEASES:?}/$rel"
    docker image rm "mdlt-app:$rel" >/dev/null 2>&1 || true
  done
  rm -rf "$RELEASES"/*.tmp 2>/dev/null || true
  docker image prune -f >/dev/null
  docker builder prune -f --filter until=168h >/dev/null
}

# Todo el trabajo va dentro de una función: bash -s lee el script por stdin y
# así lo parsea completo antes de ejecutar (ningún comando hijo puede
# "comerse" el resto del script), y los hijos reciben /dev/null como stdin.
principal() {
[ -f "$ENV_FILE" ] || falla "No existe $ENV_FILE (ver docs/deploy-oracle.md)"
chmod 600 "$ENV_FILE"
mkdir -p "$MDLT_HOME/shared/certbot/conf" "$MDLT_HOME/shared/certbot/www"

case "$ACCION" in
  deploy)
    REL="$RELEASES/$SHA"
    if [ ! -f "$REL/.completa" ]; then
      log "Descomprimiendo la release $SHA"
      rm -rf "$REL.tmp" && mkdir -p "$REL.tmp"
      tar -xzf "$MDLT_HOME/tmp/$SHA.tar.gz" -C "$REL.tmp"
      chmod +x "$REL.tmp/deploy/oracle/"*.sh
      touch "$REL.tmp/.completa"
      rm -rf "$REL" && mv "$REL.tmp" "$REL"
    fi
    rm -f "$MDLT_HOME/tmp/$SHA.tar.gz"
    touch "$REL"

    log "Build de la imagen mdlt-app:$SHA"
    compose "$SHA" build app

    ANTERIOR="$(actual)"
    apuntar "$SHA"
    [ -n "$ANTERIOR" ] && [ "$ANTERIOR" != "$SHA" ] && echo "$ANTERIOR" > "$MDLT_HOME/previous"

    log "Levantando la release $SHA"
    if ! levantar "$SHA"; then
      compose "$SHA" logs --tail=80 app >&2 || true
      if [ -n "$ANTERIOR" ] && [ "$ANTERIOR" != "$SHA" ]; then
        log "La app no quedó sana: volviendo a $ANTERIOR"
        apuntar "$ANTERIOR"
        levantar "$ANTERIOR" || true
      fi
      falla "Deploy de $SHA fallido"
    fi
    verificar_https || falla "La app está sana pero HTTPS no responde 200"
    limpiar
    log "Deploy OK: $SHA"
    ;;

  rollback)
    CUR="$(actual)"
    if [ -z "$SHA" ]; then
      SHA="$(cat "$MDLT_HOME/previous" 2>/dev/null || true)"
      [ -n "$SHA" ] || SHA="$(ls -1dt "$RELEASES"/*/ | grep -v '\.tmp/$' | xargs -n1 basename | grep -vx "$CUR" | head -n1 || true)"
    fi
    [ -n "$SHA" ] && [ -f "$RELEASES/$SHA/.completa" ] || falla "No hay release a la cual volver"
    [ "$SHA" = "$CUR" ] && falla "La release $SHA ya es la actual"
    log "Rollback: $CUR → $SHA"
    apuntar "$SHA"
    echo "$CUR" > "$MDLT_HOME/previous"
    # Si la imagen se borró, compose la reconstruye desde la release.
    levantar "$SHA" || falla "La release $SHA no quedó sana"
    verificar_https || falla "HTTPS no responde 200"
    log "Rollback OK: $SHA"
    ;;

  status)
    echo "Actual:   $(actual)"
    echo "Anterior: $(cat "$MDLT_HOME/previous" 2>/dev/null || echo -)"
    echo "Releases:"; ls -1t "$RELEASES" | sed 's/^/  /'
    CUR="$(actual)"
    [ -n "$CUR" ] && compose "$CUR" ps
    docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
    free -h | head -2; df -h / | tail -1
    ;;
esac
}
principal </dev/null
REMOTO
}

# --------------------------------------------------------------------------
# Lado de la PC
# --------------------------------------------------------------------------
cd "$(git rev-parse --show-toplevel)"

if [ "$ACCION" = "deploy" ]; then
  SHA="$(git rev-parse --short=12 HEAD)"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "Aviso: hay cambios sin commitear; se despliega solo el commit $SHA." >&2
  fi
  ssh "$SSH_HOST" 'mkdir -p ~/mdlt/releases ~/mdlt/shared ~/mdlt/tmp && test -f ~/mdlt/shared/.env' \
    || { echo "Falta ~/mdlt/shared/.env en el servidor (ver docs/deploy-oracle.md)" >&2; exit 1; }

  if ssh "$SSH_HOST" "test -f ~/mdlt/releases/$SHA/.completa"; then
    echo "La release $SHA ya está en el servidor."
  else
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    echo "Empaquetando $SHA…"
    # autocrlf=false: los scripts y configs viajan con LF aunque se empaquete en Windows.
    git -c core.autocrlf=false archive --format=tar.gz -o "$TMP/$SHA.tar.gz" HEAD
    echo "Subiendo ($(du -h "$TMP/$SHA.tar.gz" | cut -f1))…"
    scp -q "$TMP/$SHA.tar.gz" "$SSH_HOST:mdlt/tmp/$SHA.tar.gz"
  fi
  remoto | ssh "$SSH_HOST" bash -s -- deploy "$SHA"
else
  remoto | ssh "$SSH_HOST" bash -s -- "$ACCION" "$OBJETIVO"
fi
