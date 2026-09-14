#!/bin/bash
# Incremental deploy: preserve .env / JSON data, build, nginx timeouts
set -euo pipefail
export NODE_OPTIONS=--max-old-space-size=1536
APP_DIR=/var/www/icocard
cd "$APP_DIR"

BACKUP=/tmp/icocard-runtime-json
mkdir -p "$BACKUP"
for dir in backend/src/data backend/dist/data; do
  if [ -d "$dir" ]; then
    find "$dir" -maxdepth 1 -name '*.json' -exec cp -f {} "$BACKUP/" \;
  fi
done

git fetch origin main
git reset --hard origin/main

mkdir -p "$APP_DIR/backend/src/data" "$APP_DIR/backend/dist/data"
if [ -d "$BACKUP" ]; then
  cp -f "$BACKUP"/*.json "$APP_DIR/backend/src/data/" 2>/dev/null || true
  cp -f "$BACKUP"/*.json "$APP_DIR/backend/dist/data/" 2>/dev/null || true
fi

ENV_FILE="$APP_DIR/backend/.env"
if [ -f "$ENV_FILE" ]; then
  grep -q '^WALLET_ENC_KEY=' "$ENV_FILE" || echo "WALLET_ENC_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
  if grep -q '^USE_MOCK_WIREX=' "$ENV_FILE"; then
    sed -i 's/^USE_MOCK_WIREX=.*/USE_MOCK_WIREX=false/' "$ENV_FILE"
  else
    echo 'USE_MOCK_WIREX=false' >> "$ENV_FILE"
  fi
fi

NGINX_SITE=/etc/nginx/sites-available/icocard
if [ -f "$NGINX_SITE" ] && ! grep -q 'proxy_read_timeout' "$NGINX_SITE"; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/nginx/sites-available/icocard")
t = p.read_text()
t = t.replace(
    "proxy_http_version 1.1;",
    "proxy_http_version 1.1;\n        proxy_read_timeout 180s;\n        proxy_send_timeout 180s;",
)
p.write_text(t)
PY
  nginx -t && systemctl reload nginx
fi

cd "$APP_DIR/backend"
npm ci
npm run build
if [ -d "$BACKUP" ]; then
  mkdir -p dist/data
  cp -f "$BACKUP"/*.json dist/data/ 2>/dev/null || true
  cp -f "$BACKUP"/*.json src/data/ 2>/dev/null || true
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

cd "$APP_DIR/frontend"
npm ci
npm run build

echo DEPLOY_OK
git -C "$APP_DIR" rev-parse --short HEAD
