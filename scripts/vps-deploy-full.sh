#!/bin/bash
# ICOCARD full deploy on VPS (Ubuntu Server)
# Run as root: bash /tmp/vps-deploy-full.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export NODE_OPTIONS=--max-old-space-size=1536

APP_DIR=/var/www/icocard
REPO=https://github.com/ziobiz/Card-Personal.git
IP=$(hostname -I | awk '{print $1}')

echo "[1/9] packages"
apt-get update -y
apt-get install -y curl git nginx ufw build-essential openssl certbot python3-certbot-nginx

echo "[2/9] swap"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "[3/9] node20 + pm2"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "[4/9] firewall"
ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[5/9] clone"
mkdir -p /var/www
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git fetch origin main && git reset --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone --depth 1 -b main "$REPO" "$APP_DIR"
fi

echo "[6/9] backend env"
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  JWT=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
HOST=0.0.0.0
PORT=3001
JWT_SECRET=${JWT}
ADMIN_EMAIL=admin@icocard.local
ADMIN_PASSWORD=ChangeMeAfterDeploy!
USE_MOCK_WIREX=true
WIREX_ENV=sandbox
OTP_REQUIRED_ORG=true
OTP_REQUIRED_MEMBER=true
OTP_REQUIRED_ADMIN=true
EOF
  chmod 600 "$ENV_FILE"
fi

echo "[7/9] build backend + pm2"
cd "$APP_DIR/backend"
npm ci
npm run build
pm2 delete icocard-api 2>/dev/null || true
pm2 start dist/index.js --name icocard-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep -E '^(sudo |systemctl)' | bash || true

echo "[8/9] build frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "[9/9] nginx multi-host"
cat > /etc/nginx/sites-available/icocard <<'NGINX'
# Member site
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name icocard.net www.icocard.net _;
    root /var/www/icocard/frontend/dist;
    index index.html;
    client_max_body_size 10m;

    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /v2/webhooks/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /health {
        proxy_pass http://127.0.0.1:3001;
    }
}

# Admin portal (same SPA, /admin)
server {
    listen 80;
    listen [::]:80;
    server_name admin.icocard.net;
    root /var/www/icocard/frontend/dist;
    index index.html;
    client_max_body_size 10m;

    location = / {
        return 302 /admin/login;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Partner portal
server {
    listen 80;
    listen [::]:80;
    server_name partner.icocard.net;
    root /var/www/icocard/frontend/dist;
    index index.html;

    location = / {
        return 302 /partner/login;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API host (partner REST)
server {
    listen 80;
    listen [::]:80;
    server_name api.icocard.net;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/icocard /etc/nginx/sites-enabled/icocard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "==== HTTP DONE ===="
curl -s http://127.0.0.1/health || true
echo ""
pm2 status
echo ""
echo "Sites:"
echo "  http://$IP/"
echo "  http://icocard.net/"
echo "  http://admin.icocard.net/admin/login"
echo "  http://partner.icocard.net/partner/login"
echo "  http://api.icocard.net/health"
echo ""
echo "Admin: admin@icocard.local / ChangeMeAfterDeploy!"
echo ""
echo "HTTPS (after DNS ok):"
echo "  certbot --nginx -d icocard.net -d www.icocard.net -d admin.icocard.net -d partner.icocard.net -d api.icocard.net --non-interactive --agree-tos -m admin@icocard.net --redirect"
