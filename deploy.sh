#!/bin/bash
set -euo pipefail

# --- ALLGEMEINE KONFIGURATION ---
GIT_REPO="https://github.com/ManuelRichardt/ausleihe.git"
APP_DIR="/var/www/app"

# --- PROD SPEZIFISCH (Wird nur bei --prod genutzt) ---
MAIL="deine-mail@beispiel.de"
EAB_KID="DEINE_KEY_ID"
EAB_HMAC="DEIN_HMAC_KEY"
API_URL="https://api.dein-rechenzentrum.de/acme"
DOMAIN="deine-domain.de"

# Modus auslesen
MODE=${1:-}

if [[ "$MODE" != "--dev" && "$MODE" != "--prod" ]]; then
    echo "Fehler: Bitte Modus angeben! Nutzung: ./deploy.sh --dev ODER ./deploy.sh --prod"
    exit 1
fi

echo "Starte Deployment im Modus: ${MODE#--}"

prepare_env_file() {
    local compose_file="$APP_DIR/docker-compose.yml"
    local env_example_file="$APP_DIR/.env.example"
    local env_file="$APP_DIR/.env"

    if [ ! -f "$compose_file" ]; then
        echo "Fehler: $compose_file fehlt."
        exit 1
    fi

    if [ ! -f "$env_file" ]; then
        if [ ! -f "$env_example_file" ]; then
            echo "Fehler: Weder $env_file noch $env_example_file vorhanden."
            exit 1
        fi
        cp "$env_example_file" "$env_file"
        echo ".env aus .env.example erstellt."
    fi

    python3 - "$compose_file" "$env_file" <<'PY'
import re
import sys

compose_path, env_path = sys.argv[1], sys.argv[2]

with open(compose_path, "r", encoding="utf-8") as fh:
    compose_lines = fh.read().splitlines()

db_values = {}
in_services = False
in_db = False
in_environment = False

for line in compose_lines:
    if re.match(r"^\s*services:\s*$", line):
        in_services = True
        continue
    if not in_services:
        continue
    if re.match(r"^\S", line):
        break

    if re.match(r"^\s{2}db:\s*$", line):
        in_db = True
        in_environment = False
        continue

    if in_db and re.match(r"^\s{2}[A-Za-z0-9_-]+:\s*$", line) and not re.match(r"^\s{2}db:\s*$", line):
        in_db = False
        in_environment = False

    if not in_db:
        continue

    if re.match(r"^\s{4}environment:\s*$", line):
        in_environment = True
        continue

    if not in_environment:
        continue

    map_match = re.match(r"^\s{6}([A-Z0-9_]+):\s*(.*?)\s*$", line)
    if map_match:
        key, value = map_match.groups()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        db_values[key] = value
        continue

    list_match = re.match(r"^\s{6}-\s*([A-Z0-9_]+)=(.*)\s*$", line)
    if list_match:
        key, value = list_match.groups()
        db_values[key] = value.strip()
        continue

    if line.strip() and not line.startswith("      "):
        in_environment = False

db_name = db_values.get("MARIADB_DATABASE")
db_user = db_values.get("MARIADB_USER")
db_password = db_values.get("MARIADB_PASSWORD")

if not db_name or not db_user or not db_password:
    raise SystemExit(
        "Fehler: MARIADB_DATABASE, MARIADB_USER oder MARIADB_PASSWORD konnten aus docker-compose.yml nicht gelesen werden."
    )

updates = {
    "DB_HOST": "db",
    "DB_PORT": "3306",
    "DB_NAME": db_name,
    "DB_USER": db_user,
    "DB_PASSWORD": db_password,
}

with open(env_path, "r", encoding="utf-8") as fh:
    env_lines = fh.read().splitlines()

patched_lines = []
seen = set()
for line in env_lines:
    if "=" in line and not line.lstrip().startswith("#"):
        key = line.split("=", 1)[0]
        if key in updates:
            patched_lines.append(f"{key}={updates[key]}")
            seen.add(key)
            continue
    patched_lines.append(line)

for key, value in updates.items():
    if key not in seen:
        patched_lines.append(f"{key}={value}")

with open(env_path, "w", encoding="utf-8") as fh:
    fh.write("\n".join(patched_lines).rstrip("\n") + "\n")

print("DB-Variablen in .env wurden aus docker-compose.yml gesetzt.")
PY
}

validate_session_secret() {
    local env_file="$APP_DIR/.env"
    local session_secret
    session_secret=$(grep -E '^SESSION_SECRET=' "$env_file" | tail -n1 | cut -d= -f2- || true)

    if [ -z "$session_secret" ]; then
        echo "Fehler: SESSION_SECRET fehlt in $env_file."
        exit 1
    fi

    local secret_length=${#session_secret}
    if [ "$secret_length" -lt 32 ]; then
        echo "Fehler: SESSION_SECRET ist zu kurz (mindestens 32 Zeichen erforderlich)."
        exit 1
    fi

    if echo "$session_secret" | grep -Eiq 'change_me|changeme|replace_with|example|default|password'; then
        echo "Fehler: SESSION_SECRET scheint ein Platzhalter zu sein. Bitte durch einen starken Zufallswert ersetzen."
        exit 1
    fi
}

validate_compose_env_values() {
    local env_file="$APP_DIR/.env"
    python3 - "$env_file" <<'PY'
import sys

env_path = sys.argv[1]
invalid = []

with open(env_path, "r", encoding="utf-8") as fh:
    for lineno, raw_line in enumerate(fh, 1):
        line = raw_line.rstrip("\n")
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        idx = 0
        while idx < len(value):
            if value[idx] != "$":
                idx += 1
                continue
            if idx + 1 < len(value) and value[idx + 1] == "$":
                idx += 2
                continue
            invalid.append((lineno, key.strip()))
            break

if invalid:
    print("Fehler: .env enthält unescapete '$'-Zeichen. Docker Compose interpretiert diese als Variablen.")
    print("Bitte '$' als '$$' escapen oder Secrets ohne '$' verwenden.")
    for lineno, key in invalid:
        print(f"  Zeile {lineno}: {key}")
    raise SystemExit(1)
PY
}

# 1. System-Updates & Docker
sudo apt update && sudo apt install -y curl git nginx openssl python3-certbot-nginx
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

DOCKER_COMPOSE_CMD=(docker compose)
if ! docker info &> /dev/null; then
    DOCKER_COMPOSE_CMD=(sudo docker compose)
fi

if ! "${DOCKER_COMPOSE_CMD[@]}" version &> /dev/null; then
    echo "Fehler: 'docker compose' ist nicht verfügbar. Bitte Docker Compose Plugin installieren."
    exit 1
fi

# 2. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# 3. Projekt klonen
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
if [ ! -d "$APP_DIR/.git" ]; then
    git clone $GIT_REPO $APP_DIR
else
    git -C "$APP_DIR" pull --ff-only
fi

prepare_env_file
validate_session_secret
validate_compose_env_values

# 4. SSL Zertifikate generieren (Modus-Abhängig)
sudo systemctl stop nginx

if [ "$MODE" == "--dev" ]; then
    echo "Modus DEV: Generiere Self-Signed Zertifikate..."
    sudo mkdir -p /etc/nginx/ssl
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/cert.key \
      -out /etc/nginx/ssl/cert.crt \
      -subj "/C=DE/ST=State/L=City/O=Dev/CN=localhost"
    CERT_PATH="/etc/nginx/ssl/cert.crt"
    KEY_PATH="/etc/nginx/ssl/cert.key"
    SERVER_NAME="_"
else
    echo "Modus PROD: Fordere Zertifikat via EAB an..."
    sudo certbot certonly --standalone --non-interactive --agree-tos \
      --email "$MAIL" \
      --eab-kid "$EAB_KID" \
      --eab-hmac-key "$EAB_HMAC" \
      --server "$API_URL" \
      --domain "$DOMAIN"
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    SERVER_NAME="$DOMAIN"
fi

# 5. Nginx Konfiguration
echo "Konfiguriere Nginx..."
NGINX_CONF="/etc/nginx/sites-available/nodejs-app"
sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $SERVER_NAME;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 6. Docker Compose starten
cd "$APP_DIR"
# npm install auf dem Host ist nicht nötig: der Docker-Build installiert Node-Dependencies.
"${DOCKER_COMPOSE_CMD[@]}" up -d --build

# 6a. Datenbank-Verfügbarkeit prüfen
echo "Warte auf Datenbank-Start ..."
DB_READY=0
for i in $(seq 1 60); do
    if "${DOCKER_COMPOSE_CMD[@]}" exec -T db sh -lc 'mariadb-admin ping -h 127.0.0.1 -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" --silent' > /dev/null 2>&1; then
        DB_READY=1
        break
    fi
    sleep 2
done

if [ "$DB_READY" -ne 1 ]; then
    echo "Fehler: Datenbank ist nicht erreichbar."
    "${DOCKER_COMPOSE_CMD[@]}" ps || true
    "${DOCKER_COMPOSE_CMD[@]}" logs --tail=100 db || true
    exit 1
fi

# 6b. Schreibrechte für Uploadpfade im Container prüfen
echo "Prüfe Schreibrechte in Upload-Verzeichnissen ..."
if ! "${DOCKER_COMPOSE_CMD[@]}" exec -T app sh -lc 'set -e; mkdir -p /app/public/uploads/asset-models /app/uploads/signatures; touch /app/public/uploads/asset-models/.perm-test; touch /app/uploads/signatures/.perm-test; rm -f /app/public/uploads/asset-models/.perm-test /app/uploads/signatures/.perm-test'; then
    echo "Fehler: Upload-Verzeichnisse im App-Container sind nicht beschreibbar."
    "${DOCKER_COMPOSE_CMD[@]}" logs --tail=100 app || true
    exit 1
fi

# 7. App-Verfügbarkeit prüfen, bevor Nginx gestartet wird
echo "Warte auf App-Start auf http://127.0.0.1:3000/login ..."
APP_READY=0
for i in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3000/login > /dev/null 2>&1; then
        APP_READY=1
        break
    fi
    sleep 2
done

if [ "$APP_READY" -ne 1 ]; then
    echo "Fehler: App ist auf Port 3000 nicht betriebsbereit."
    "${DOCKER_COMPOSE_CMD[@]}" ps || true
    "${DOCKER_COMPOSE_CMD[@]}" logs --tail=100 db || true
    "${DOCKER_COMPOSE_CMD[@]}" logs --tail=100 app || true
    exit 1
fi

# 8. Nginx starten (nach erfolgreichem App-Start)
sudo systemctl start nginx

echo "Setup abgeschlossen im Modus ${MODE#--}!"
echo "Status:"
"${DOCKER_COMPOSE_CMD[@]}" ps
"${DOCKER_COMPOSE_CMD[@]}" logs --tail=20 app || true
