#!/bin/bash
# SSH 접속 후: bash <(curl -fsSL ...) 또는 아래를 통째로 붙여넣기
# ICOCARD VPS 원샷 설치+배포
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export NODE_OPTIONS=--max-old-space-size=1536

APP_DIR=/var/www/icocard
REPO=https://github.com/ziobiz/Card-Personal.git

echo "[1/8] apt update + packages"
apt-get update -y
apt-get install -y curl git nginx ufw build-essential openssl

echo "[2/8] swap 2G"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show || true

echo "[3/8] Node 20 + PM2"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v
npm install -g pm2

echo "[4/8] firewall"
ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

echo "[5/8] clone repo"
mkdir -p /var/www
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git fetch origin main && git reset --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone --depth 1 -b main "$REPO" "$APP_DIR"
fi

echo "[6/8] backend .env"
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
EOF
  chmod 600 "$ENV_FILE"
fi

echo "[7/8] build + pm2"
cd "$APP_DIR/backend"
npm ci
npm run build
pm2 delete icocard-api 2>/dev/null || true
pm2 start dist/index.js --name icocard-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep -E '^(sudo |systemctl)' | bash || true

cd "$APP_DIR/frontend"
npm ci
npm run build

echo "[8/8] nginx"
cat > /etc/nginx/sites-available/icocard <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
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
NGINX
ln -sf /etc/nginx/sites-available/icocard /etc/nginx/sites-enabled/icocard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "==== DONE ===="
curl -s http://127.0.0.1/health || curl -s http://127.0.0.1:3001/health || true
echo ""
echo "Open: http://104.37.184.174/"
echo "Admin: http://104.37.184.174/admin/login"
echo "  email: admin@icocard.local"
echo "  password: ChangeMeAfterDeploy!  (change in /var/www/icocard/backend/.env)"
pm2 status
