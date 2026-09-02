#!/bin/bash
# ICOCARD — Ubuntu 24.04 VPS 초기 환경 (InterServer 등)
# 사용: bash vps-bootstrap.sh
set -euo pipefail

APP_DIR=/var/www/icocard
REPO_URL="${REPO_URL:-https://github.com/ziobiz/Card-Personal.git}"
BRANCH="${BRANCH:-main}"

echo "==> 시스템 업데이트"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> 기본 패키지"
apt-get install -y curl git nginx ufw build-essential

echo "==> swap 2GB (빌드용)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Node.js 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> 방화벽"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 앱 디렉터리"
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR" && git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH"
fi

echo "==> backend .env (없을 때만)"
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
  echo "    backend/.env 생성됨 — ADMIN_PASSWORD 변경 권장"
fi

echo "==> 의존성 및 빌드 (2GB RAM용)"
export NODE_OPTIONS=--max-old-space-size=1536
cd "$APP_DIR/backend"
npm ci
npm run build

cd "$APP_DIR/frontend"
npm ci
npm run build
unset NODE_OPTIONS

echo "==> PM2"
cd "$APP_DIR/backend"
pm2 delete icocard-api 2>/dev/null || true
pm2 start dist/index.js --name icocard-api
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "==> Nginx"
NGINX_SRC="$APP_DIR/scripts/nginx-icocard.conf"
if [ ! -f "$NGINX_SRC" ] && [ -f /tmp/nginx-icocard.conf ]; then
  NGINX_SRC=/tmp/nginx-icocard.conf
fi
install -m 644 "$NGINX_SRC" /etc/nginx/sites-available/icocard
ln -sf /etc/nginx/sites-available/icocard /etc/nginx/sites-enabled/icocard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "완료. 확인:"
echo "  curl -s http://127.0.0.1/health"
echo "  브라우저: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
