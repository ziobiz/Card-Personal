#!/bin/bash
set -e
cd /var/www/icocard/backend

cat > /tmp/m.json <<'EOF'
{"email":"test1@test.com","password":"test1234"}
EOF
cat > /tmp/a.json <<'EOF'
{"email":"tester@icocard.local","password":"Test1234!"}
EOF
cat > /tmp/a2.json <<'EOF'
{"email":"admin@icocard.local","password":"ChangeMeAfterDeploy!"}
EOF

echo "=== MEMBER LOGIN ==="
curl -s -X POST http://127.0.0.1:3001/api/auth/login -H 'Content-Type: application/json' --data-binary @/tmp/m.json
echo
echo "=== TESTER ADMIN LOGIN ==="
curl -s -X POST http://127.0.0.1:3001/api/admin/login -H 'Content-Type: application/json' --data-binary @/tmp/a.json
echo
echo "=== HQ ADMIN LOGIN ==="
curl -s -X POST http://127.0.0.1:3001/api/admin/login -H 'Content-Type: application/json' --data-binary @/tmp/a2.json
echo
echo "=== USERS ==="
python3 - <<'PY'
import json
from pathlib import Path
for p in [Path('dist/data/users.json'), Path('src/data/users.json')]:
    if p.exists():
        d=json.loads(p.read_text())
        print(p, [(u.get('email'), u.get('otpEnabled'), bool(u.get('otpSecret'))) for u in d.get('users',[])])
for p in [Path('dist/data/operators.json'), Path('src/data/operators.json')]:
    if p.exists():
        d=json.loads(p.read_text())
        print(p, [(o.get('email'), o.get('otpEnabled'), bool(o.get('otpSecret')), o.get('status')) for o in d.get('operators',[])])
PY
