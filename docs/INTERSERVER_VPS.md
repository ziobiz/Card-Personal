# InterServer VPS 배포 (Ubuntu 24.04)

## 서버 정보 예시

| 항목 | 값 |
|------|-----|
| IP | `104.37.184.174` |
| SSH | `ssh root@104.37.184.174` |
| OS | Ubuntu 24.04 Server 권장 |

## 1. SSH 접속 (Windows PowerShell)

```powershell
ssh root@104.37.184.174
```

처음 접속 시 `yes` 입력.

## 2. 한 번에 환경 설치

서버에서:

```bash
curl -fsSL https://raw.githubusercontent.com/ziobiz/Card-Personal/main/scripts/vps-bootstrap.sh -o /tmp/vps-bootstrap.sh
bash /tmp/vps-bootstrap.sh
```

또는 PC에서 스크립트 업로드 후:

```powershell
scp D:\Delopment\Card-Personal\scripts\vps-bootstrap.sh root@104.37.184.174:/tmp/
scp D:\Delopment\Card-Personal\scripts\nginx-icocard.conf root@104.37.184.174:/tmp/
ssh root@104.37.184.174 "bash /tmp/vps-bootstrap.sh"
```

## 3. 확인

- http://104.37.184.174/ — 사용자 웹
- http://104.37.184.174/admin/login — 관리자
- http://104.37.184.174/health — API 헬스

초기 관리자: `backend/.env` 의 `ADMIN_EMAIL` / `ADMIN_PASSWORD` (스크립트 기본값은 `ChangeMeAfterDeploy!`)

## 4. 도메인 연동 후

도메인 업체 DNS:

| 타입 | 이름 | 값 |
|------|------|-----|
| A | @ | VPS IP |
| A | www | VPS IP |

Nginx `server_name` 수정 후:

```bash
certbot --nginx -d example.com -d www.example.com
```

## 5. 재배포

```bash
cd /var/www/icocard
git pull origin main
cd backend && npm ci && npm run build && pm2 restart icocard-api
cd ../frontend && npm ci && npm run build
```

## 6. 보안

- root 비밀번호는 채팅·Git에 넣지 마세요.
- 배포 후 `passwd` 및 `ADMIN_PASSWORD` 변경.
- `JWT_SECRET` 은 서버 `.env` 에만 보관.
