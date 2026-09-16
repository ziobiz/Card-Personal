#!/bin/bash
# Incremental deploy: preserve .env / JSON data / OG assets, build, nginx OG/SPA
set -euo pipefail
export NODE_OPTIONS=--max-old-space-size=1536
APP_DIR=/var/www/icocard
cd "$APP_DIR"

BACKUP=/tmp/icocard-runtime-json
OG_BACKUP=/tmp/icocard-og-assets
mkdir -p "$BACKUP" "$OG_BACKUP"
for dir in backend/src/data backend/dist/data; do
  if [ -d "$dir" ]; then
    find "$dir" -maxdepth 1 -name '*.json' -exec cp -f {} "$BACKUP/" \;
  fi
done
for dir in backend/src/data/og-assets backend/dist/data/og-assets; do
  if [ -d "$dir" ]; then
    cp -a "$dir/." "$OG_BACKUP/" 2>/dev/null || true
  fi
done

git fetch origin main
git reset --hard origin/main

mkdir -p "$APP_DIR/backend/src/data" "$APP_DIR/backend/dist/data"
mkdir -p "$APP_DIR/backend/src/data/og-assets" "$APP_DIR/backend/dist/data/og-assets"
if [ -d "$BACKUP" ]; then
  cp -f "$BACKUP"/*.json "$APP_DIR/backend/src/data/" 2>/dev/null || true
  cp -f "$BACKUP"/*.json "$APP_DIR/backend/dist/data/" 2>/dev/null || true
fi
if [ -d "$OG_BACKUP" ] && [ "$(ls -A "$OG_BACKUP" 2>/dev/null || true)" ]; then
  cp -a "$OG_BACKUP/." "$APP_DIR/backend/src/data/og-assets/" 2>/dev/null || true
  cp -a "$OG_BACKUP/." "$APP_DIR/backend/dist/data/og-assets/" 2>/dev/null || true
fi

ENV_FILE="$APP_DIR/backend/.env"
if [ -f "$ENV_FILE" ]; then
  grep -q '^WALLET_ENC_KEY=' "$ENV_FILE" || echo "WALLET_ENC_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
  if grep -q '^USE_MOCK_WIREX=' "$ENV_FILE"; then
    sed -i 's/^USE_MOCK_WIREX=.*/USE_MOCK_WIREX=false/' "$ENV_FILE"
  else
    echo 'USE_MOCK_WIREX=false' >> "$ENV_FILE"
  fi
  if grep -q '^FRONTEND_DIST=' "$ENV_FILE"; then
    sed -i 's|^FRONTEND_DIST=.*|FRONTEND_DIST=/var/www/icocard/frontend/dist|' "$ENV_FILE"
  else
    echo 'FRONTEND_DIST=/var/www/icocard/frontend/dist' >> "$ENV_FILE"
  fi
fi

NGINX_SITE=/etc/nginx/sites-available/icocard
if [ -f "$NGINX_SITE" ]; then
  python3 "$APP_DIR/scripts/nginx-ensure-og.py" "$NGINX_SITE" || true
  nginx -t && systemctl reload nginx || true
fi

cd "$APP_DIR/backend"
npm ci
npm run build
if [ -d "$BACKUP" ]; then
  mkdir -p dist/data dist/data/og-assets
  cp -f "$BACKUP"/*.json dist/data/ 2>/dev/null || true
  cp -f "$BACKUP"/*.json src/data/ 2>/dev/null || true
fi
if [ -d "$OG_BACKUP" ] && [ "$(ls -A "$OG_BACKUP" 2>/dev/null || true)" ]; then
  mkdir -p dist/data/og-assets src/data/og-assets
  cp -a "$OG_BACKUP/." dist/data/og-assets/ 2>/dev/null || true
  cp -a "$OG_BACKUP/." src/data/og-assets/ 2>/dev/null || true
fi

python3 - <<'PY'
import json, os
for p in [
  "/var/www/icocard/backend/src/data/settings.json",
  "/var/www/icocard/backend/dist/data/settings.json",
]:
  if not os.path.exists(p):
    continue
  try:
    data = json.load(open(p, encoding="utf-8"))
  except Exception:
    data = {}
  data["useMockWirex"] = False
  w = data.get("wirex") or {}
  w["environment"] = w.get("environment") or "sandbox"
  data["wirex"] = w
  json.dump(data, open(p, "w", encoding="utf-8"), indent=2)
print("settings mock=false")
PY

pm2 restart icocard-api --update-env
sleep 2
curl -sS http://127.0.0.1:3001/api/health || true
echo
# Smoke: OG tags present for member vs admin paths
curl -sS -H 'X-Original-URI: /login' -H 'Host: icocard.net' -H 'X-Forwarded-Proto: https' \
  'http://127.0.0.1:3001/api/public/spa' | tr '\n' ' ' | grep -o 'og:title[^>]*>' | head -1 || true
curl -sS -H 'X-Original-URI: /admin/login' -H 'Host: admin.icocard.net' -H 'X-Forwarded-Proto: https' \
  'http://127.0.0.1:3001/api/public/spa' | tr '\n' ' ' | grep -o 'og:title[^>]*>' | head -1 || true

cd "$APP_DIR/frontend"
npm ci
npm run build

echo DEPLOY_OK
git -C "$APP_DIR" rev-parse --short HEAD
