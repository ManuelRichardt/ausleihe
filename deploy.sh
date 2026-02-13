#!/bin/bash

# --- KONFIGURATION (Hier deine Daten eintragen) ---
DOMAIN="dein-server.de"
MAIL="deine-mail@beispiel.de"
EAB_KID="DEINE_KEY_ID"
EAB_HMAC="DEIN_HMAC_KEY"
API_URL="https://api.dein-rechenzentrum.de/acme"
GIT_REPO="https://github.com/user/repo.git"
# --------------------------------------------------

echo "🚀 Starte Deployment mit EAB-Zertifizierung..."

# 1. System & Docker
sudo apt update && sudo apt install -y curl git nginx python3-certbot-nginx
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 2. Firewall öffnen
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# 3. Nginx STOPPEN (Wichtig für --standalone)
sudo systemctl stop nginx

# 4. Zertifikat holen mit deinem speziellen Befehl
echo "🔒 Fordere Zertifikat via EAB an..."
sudo certbot certonly --standalone --non-interactive --agree-tos \
  --email "$MAIL" \
  --eab-kid "$EAB_KID" \
  --eab-hmac-key "$EAB_HMAC" \
  --server "$API_URL" \
  --domain "$DOMAIN"

# 5. Nginx Konfiguration (Manuelle SSL-Einbindung)
echo "🌐 Erstelle Nginx SSL-Konfiguration..."
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Optimierte SSL-Einstellungen
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_cipher_list 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

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

sudo ln -s $NGINX_CONF /etc/nginx/sites-enabled/ 2>/dev/null
sudo systemctl start nginx

# 6. Projekt-Setup
mkdir -p /var/www/app && cd /var/www/app
if [ ! -d ".git" ]; then git clone $GIT_REPO . ; fi

echo "✅ Fertig! Vergiss nicht, die .env Datei in /var/www/app zu erstellen."
echo "Danach: 'docker compose up -d --build'"