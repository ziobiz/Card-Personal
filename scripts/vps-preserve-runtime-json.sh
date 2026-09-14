#!/bin/bash
set -euo pipefail
# Ensure live sandbox settings survive tsc (json not copied by default)
SRC=/var/www/icocard/backend/src/data/settings.json
DST=/var/www/icocard/backend/dist/data/settings.json
BRAND_SRC=/var/www/icocard/backend/src/data/brand.json
BRAND_DST=/var/www/icocard/backend/dist/data/brand.json
mkdir -p /var/www/icocard/backend/dist/data
if [ -f "$SRC" ]; then cp -f "$SRC" "$DST"; echo copied settings; fi
if [ -f "$BRAND_SRC" ]; then cp -f "$BRAND_SRC" "$BRAND_DST"; echo copied brand; fi
# force mock false + ensure locales defaults in brand if missing
python3 - <<'PY'
import json, os
from datetime import datetime, timezone
sp="/var/www/icocard/backend/src/data/settings.json"
dp="/var/www/icocard/backend/dist/data/settings.json"
for p in [sp, dp]:
  try: data=json.load(open(p,encoding="utf-8"))
  except Exception: data={}
  data["useMockWirex"]=False
  w=data.get("wirex") or {}
  w["environment"]=w.get("environment") or "sandbox"
  data["wirex"]=w
  json.dump(data, open(p,"w",encoding="utf-8"), indent=2)
bp="/var/www/icocard/backend/src/data/brand.json"
bd="/var/www/icocard/backend/dist/data/brand.json"
for p in [bp, bd]:
  try: b=json.load(open(p,encoding="utf-8"))
  except Exception: b={}
  if not b.get("enabledLocales"):
    b["enabledLocales"]=["ko","en","ja","zh","th"]
  if not b.get("defaultLocale"):
    b["defaultLocale"]="en"
  os.makedirs(os.path.dirname(p), exist_ok=True)
  json.dump(b, open(p,"w",encoding="utf-8"), indent=2)
print("ok")
PY
pm2 restart icocard-api --update-env
sleep 1
curl -s http://127.0.0.1:3001/api/health; echo
curl -s http://127.0.0.1:3001/api/brand | python3 -c "import sys,json;d=json.load(sys.stdin);print('locales',d.get('enabledLocales'),'default',d.get('defaultLocale'))"
