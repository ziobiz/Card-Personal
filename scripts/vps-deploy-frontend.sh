#!/bin/bash
set -euo pipefail
cd /var/www/icocard
git fetch origin main
git reset --hard origin/main
cd frontend
npm ci
npm run build
echo DEPLOY_OK
git rev-parse --short HEAD
