#!/usr/bin/env bash

set -euo pipefail

REPO_URL_DEFAULT="https://github.com/ManuelRichardt/ausleihe.git"
APP_DIR_DEFAULT="/opt/ausleihe"
BRANCH_DEFAULT="main"
SERVER_NAME_DEFAULT="_"
APP_PORT_DEFAULT="3000"
NGINX_SITE_DEFAULT="ausleihe"

REPO_URL="${REPO_URL:-$REPO_URL_DEFAULT}"
APP_DIR="${APP_DIR:-$APP_DIR_DEFAULT}"
BRANCH="${BRANCH:-$BRANCH_DEFAULT}"
SERVER_NAME="${SERVER_NAME:-$SERVER_NAME_DEFAULT}"
APP_PORT="${APP_PORT:-$APP_PORT_DEFAULT}"
NGINX_SITE="${NGINX_SITE:-$NGINX_SITE_DEFAULT}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
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

install_prerequisites() {
  as_root apt-get update -y
  as_root apt-get install -y ca-certificates curl git docker nginx

  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | as_root sh
  fi

  if ! docker compose version >/dev/null 2>&1; then
    as_root apt-get install -y docker-compose-plugin
  fi

  if [[ "$(id -u)" -ne 0 ]] && groups "${USER}" | grep -qv '\bdocker\b'; then
    as_root usermod -aG docker "${USER}"
    echo "User '${USER}' was added to docker group. Re-login may be required."
  fi
}

prepare_source() {
  as_root mkdir -p "${APP_DIR}"
  as_root chown -R "${USER}:${USER}" "${APP_DIR}"

  if [[ ! -d "${APP_DIR}/.git" ]]; then
    git clone "${REPO_URL}" "${APP_DIR}"
  fi

  cd "${APP_DIR}"
  git fetch --all --prune
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"

  if [[ ! -f "${APP_DIR}/.env" ]]; then
    cat > "${APP_DIR}/.env" <<EOF
ACCESS_TOKEN_SECRET=change_me_access_token_secret
ACCESS_TOKEN_TTL_SECONDS=900
DB_DIALECT=mariadb
DB_HOST=db
DB_NAME=inventory
DB_PASSWORD=change_me_db_password
DB_PORT=3306
DB_USER=inventory
HTTP_PORT=3000
PASSWORD_MIN_LENGTH=12
PORT=3000
REFRESH_TOKEN_SECRET=change_me_refresh_token_secret
REFRESH_TOKEN_TTL_DAYS=14
SESSION_SECRET=change_me_session_secret
NODE_ENV=development
EOF
    echo "Created ${APP_DIR}/.env. Please set secure secrets before productive usage."
  fi
}

deploy_compose() {
  cd "${APP_DIR}"
  if docker compose version >/dev/null 2>&1; then
    docker compose pull || true
    docker compose up -d --build
  else
    as_root docker compose pull || true
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

  as_root ln -sfn "${nginx_conf}" "/etc/nginx/sites-enabled/${NGINX_SITE}.conf"
  if [[ -e /etc/nginx/sites-enabled/default ]]; then
    as_root rm -f /etc/nginx/sites-enabled/default
  fi
  as_root nginx -t
  as_root systemctl enable nginx
  as_root systemctl restart nginx
}

main() {
  install_prerequisites
  prepare_source
  deploy_compose
  configure_nginx

  cat <<EOF
Deployment completed.
- Repo: ${REPO_URL}
- App dir: ${APP_DIR}
- Branch: ${BRANCH}
- Nginx server_name: ${SERVER_NAME}
- App proxied to: http://127.0.0.1:${APP_PORT}

Useful commands:
  cd ${APP_DIR}
  docker compose logs -f app
  docker compose ps
EOF
}

main
