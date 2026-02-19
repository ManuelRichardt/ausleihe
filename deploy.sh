#!/bin/bash

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
MODE=$1

if [[ "$MODE" != "--dev" && "$MODE" != "--prod" ]]; then
    echo "Fehler: Bitte Modus angeben! Nutzung: ./deploy.sh --dev ODER ./deploy.sh --prod"
    exit 1
fi

echo "Starte Deployment im Modus: ${MODE#--}"

# 1. System-Updates & Docker
sudo apt update && sudo apt install -y curl git nginx openssl python3-certbot-nginx
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
    sudo usermod -aG docker $USER
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
fi

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
    SERVER_NAME="localhost"
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

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl start nginx

echo "Setup abgeschlossen im Modus ${MODE#--}!"
echo "Vergiss nicht, die .env in $APP_DIR zu prüfen und 'docker compose up -d --build' zu starten."

# 6. Docker Compose starten
cd "$APP_DIR" && docker compose up -d --build

# 7. PM2 Monitoring starten
docker exec -it app-app-1 npx pm2 monit