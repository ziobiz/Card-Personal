# 카페24 가상서버 비즈니스(2GB) 배포

신청: [가상서버호스팅](https://hosting.cafe24.com/?controller=new_product_page&page=virtual) → **비즈니스 (2GB RAM)**

이 앱은 PHP 웹호스팅이 아니라 **Linux VPS + Node.js** 가 필요합니다. 비즈니스형은 최소 실사용 사양입니다.

## 1. 신청 시 선택

| 항목 | 권장 |
|------|------|
| 사양 | 비즈니스 (2GB) |
| OS | **Ubuntu 22.04** (또는 24.04) |
| 방화벽 | 22(SSH), **80**, **443** 허용. 3001은 Nginx만 쓰면 외부 공개 불필요 |

발급되는 주소: `아이디.mycafe24.com` + 공인 IP.

설치비는 일반형과 동일합니다. 나중에 라이브 트래픽이 늘면 **4GB(자이언트)로만 상향**하면 됩니다.

## 2. 2GB에서 빌드하지 않기

서버에서 `npm run build` 하면 메모리 부족으로 죽을 수 있습니다.

- PC에서 `frontend` / `backend` 빌드
- 서버에는 `backend/dist`, `frontend/dist`, `backend/package.json` 만 올리고 `npm ci --omit=dev`

또는 서버에서 빌드할 때는 swap 2GB를 먼저 만듭니다.

## 3. 서버 `.env` (backend)

```
HOST=0.0.0.0
PORT=3001
JWT_SECRET=(긴 임의 문자열)
ADMIN_EMAIL=...
ADMIN_PASSWORD=(기본 admin123 금지)
USE_MOCK_WIREX=true
WIREX_ENV=sandbox
```

`HOST=0.0.0.0` 이어야 Nginx/공인 IP에서 API에 붙습니다. 로컬 개발은 `127.0.0.1` 유지.

프론트 빌드:

```
cd frontend
set VITE_API_URL=https://아이디.mycafe24.com
npm run build
```

같은 도메인에서 Nginx가 `/api` 를 넘기면 `VITE_API_URL` 을 비워도 됩니다 (`api.ts` 가 `/api` 상대경로 사용).

## 4. Nginx (80 → 프론트 + API + 웹훅)

Wirex 웹훅: `https://아이디.mycafe24.com/v2/webhooks/activities` 등.

```nginx
server {
    listen 80;
    server_name 아이디.mycafe24.com;

    root /var/www/card/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
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
```

SSL은 카페24 인증서 또는 `certbot`. HTTPS가 되어야 Wirex 웹훅을 받을 수 있습니다.

## 5. Node 실행

```
cd /var/www/card/backend
npm ci --omit=dev
npx tsc
# 또는 PC에서 만든 dist 사용
node dist/index.js
```

재부팅 후에도 켜 두려면 systemd 또는 PM2.

확인: `https://아이디.mycafe24.com/health` → `{ "ok": true, ... }`

## 6. 아직 서버에서 안 되는 것

- 데이터는 JSON 파일입니다. 디스크에 남지만 백업은 직접 해야 합니다.
- Wirex **라이브 카드**는 Mock을 끄고 온체인 월렛 + 본인 자격증명이 필요합니다. 비즈니스 VPS는 그 앞단(웹·API 공개)만 해결합니다.
