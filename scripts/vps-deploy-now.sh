#!/bin/bash
set -euo pipefail
cd /var/www/icocard
git fetch origin main
git reset --hard origin/main
cd backend
npm ci
npm run build
pm2 restart icocard-api --update-env
cd ../frontend
npm ci
npm run build
echo DEPLOY_OK
git rev-parse --short HEAD
curl -s http://127.0.0.1:3001/api/health
echo
