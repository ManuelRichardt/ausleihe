#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
SERVER_NAME="${SERVER_NAME:-_}"
APP_PORT="${APP_PORT:-3000}"
NGINX_SITE="${NGINX_SITE:-ausleihe}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --server-name)
      SERVER_NAME="$2"
      shift 2
      ;;
    --app-port)
      APP_PORT="$2"
      shift 2
      ;;
    --site-name)
      NGINX_SITE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64
  fi
}

ensure_env_key() {
  local key="$1"
  local value="$2"
  local env_file="$3"
  if ! grep -q "^${key}=" "$env_file"; then
    echo "${key}=${value}" >>"$env_file"
  fi
}

install_prerequisites() {
  as_root apt-get update -y
  as_root apt-get install -y ca-certificates curl git nginx

  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | as_root sh
  fi

  if ! docker compose version >/dev/null 2>&1; then
    as_root apt-get install -y docker-compose-plugin
  fi

  if [[ "$(id -u)" -ne 0 ]] && ! id -nG "${USER}" | grep -qw docker; then
    as_root usermod -aG docker "${USER}"
    echo "User '${USER}' added to docker group. If docker command fails, re-login and run script again."
  fi
}

prepare_app_dir() {
  as_root mkdir -p "${APP_DIR}"
  as_root chown -R "${USER}:${USER}" "${APP_DIR}"

  if [[ "${APP_DIR}" != "${SCRIPT_DIR}" ]]; then
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='uploads/signatures' \
        "${SCRIPT_DIR}/" "${APP_DIR}/"
    else
      as_root apt-get install -y rsync
      rsync -a --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='uploads/signatures' \
        "${SCRIPT_DIR}/" "${APP_DIR}/"
    fi
  fi
}

ensure_env_file() {
  local env_file="${APP_DIR}/.env"
  if [[ ! -f "${env_file}" ]]; then
    cat >"${env_file}" <<EOF
ACCESS_TOKEN_SECRET=$(random_secret)
ACCESS_TOKEN_TTL_SECONDS=900
DB_DIALECT=mariadb
DB_HOST=db
DB_NAME=inventory
DB_PASSWORD=inventory_password
DB_PORT=3306
DB_ROOT_PASSWORD=root_password
DB_USER=inventory
ENABLE_HSTS=false
HTTP_PORT=3000
NODE_ENV=development
PASSWORD_MIN_LENGTH=12
PORT=3000
REFRESH_TOKEN_SECRET=$(random_secret)
REFRESH_TOKEN_TTL_DAYS=14
SESSION_COOKIE_SECURE=false
CSRF_COOKIE_SECURE=false
SESSION_SECRET=$(random_secret)
EOF
  else
    ensure_env_key "ACCESS_TOKEN_SECRET" "$(random_secret)" "${env_file}"
    ensure_env_key "ACCESS_TOKEN_TTL_SECONDS" "900" "${env_file}"
    ensure_env_key "DB_DIALECT" "mariadb" "${env_file}"
    ensure_env_key "DB_HOST" "db" "${env_file}"
    ensure_env_key "DB_NAME" "inventory" "${env_file}"
    ensure_env_key "DB_PASSWORD" "inventory_password" "${env_file}"
    ensure_env_key "DB_PORT" "3306" "${env_file}"
    ensure_env_key "DB_ROOT_PASSWORD" "root_password" "${env_file}"
    ensure_env_key "DB_USER" "inventory" "${env_file}"
    ensure_env_key "ENABLE_HSTS" "false" "${env_file}"
    ensure_env_key "HTTP_PORT" "3000" "${env_file}"
    ensure_env_key "NODE_ENV" "development" "${env_file}"
    ensure_env_key "PASSWORD_MIN_LENGTH" "12" "${env_file}"
    ensure_env_key "PORT" "3000" "${env_file}"
    ensure_env_key "REFRESH_TOKEN_SECRET" "$(random_secret)" "${env_file}"
    ensure_env_key "REFRESH_TOKEN_TTL_DAYS" "14" "${env_file}"
    ensure_env_key "SESSION_COOKIE_SECURE" "false" "${env_file}"
    ensure_env_key "CSRF_COOKIE_SECURE" "false" "${env_file}"
    ensure_env_key "SESSION_SECRET" "$(random_secret)" "${env_file}"
  fi
}

docker_compose_up() {
  cd "${APP_DIR}"
  if docker info >/dev/null 2>&1; then
    docker compose up -d --build
  else
    as_root docker compose up -d --build
  fi
}

configure_nginx() {
  local nginx_conf="/etc/nginx/sites-available/${NGINX_SITE}.conf"

  as_root bash -c "cat > '${nginx_conf}'" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

  as_root mkdir -p /etc/nginx/sites-enabled
  for enabled in /etc/nginx/sites-enabled/*; do
    if [[ -e "${enabled}" ]] && [[ "$(basename "${enabled}")" != "${NGINX_SITE}.conf" ]]; then
      as_root rm -f "${enabled}"
    fi
  done
  as_root ln -sfn "${nginx_conf}" "/etc/nginx/sites-enabled/${NGINX_SITE}.conf"
  as_root nginx -t
  as_root systemctl enable nginx
  as_root systemctl restart nginx
}

print_result() {
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "${server_ip}" ]]; then
    server_ip="localhost"
  fi

  cat <<EOF
Deployment completed.

Open:
  http://${server_ip}/install

Then enter:
  - Database connection
  - Initial admin account
EOF
}

main() {
  install_prerequisites
  prepare_app_dir
  ensure_env_file
  docker_compose_up
  configure_nginx
  print_result
}

main
