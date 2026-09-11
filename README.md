# ICOCARD - 개인용 카드 발급 (솔루션 패키지)

**개인용** 카드 발급 웹 서비스이자, **타 업체 판매용 Wirex BaaS 화이트라벨 패키지**입니다.  
[Wirex BaaS API](https://docs.wirexapp.com) 연동, 관리자·파트너·회원 포털 지원.

> Sandbox 전용 API Key는 Wirex 발급 후 실연동합니다. 그 전까지 Mock 유지.  
> 패키지 판매 기준: [docs/SOLUTION_PACKAGING.md](docs/SOLUTION_PACKAGING.md)

## 실행 방법

**백엔드와 프론트엔드를 둘 다 실행해야 합니다.**

### 1. 백엔드

```bash
cd backend
npm install
npm run dev
```

→ http://localhost:3001

### 2. 프론트엔드 (새 터미널)

```bash
cd frontend
npm install
npm run dev
```

→ http://localhost:3000

### 3. 사용자 웹 (카드 사용자)

1. 회원가입 → 로그인
2. 가상 카드 발급 (Wirex API 연동)
3. 카드 충전, 일일 한도 설정, 차단/해제
4. KYC 검증 (실제 API 모드에서)

### 4. 관리자 웹

- **URL**: http://localhost:3000/admin/login
- **기본 계정**: admin@icocard.local / admin123
- 사용자·카드 목록, 통계 대시보드
- **파트너 API 관리**: 타 업체 연동용 API Key 발급·관리
- **브랜드/패키지**: 화이트라벨 납품용 브랜드·도메인 설정

### 5. 파트너 API (타 업체 연동)

계약된 업체가 자체 사이트에서 우리 API로 카드 발급·지갑 연동을 제공할 수 있습니다.

→ [파트너 API 문서](docs/PARTNER_API.md)

## 솔루션 패키지 (판매)

| 모드 | 설명 |
|------|------|
| `saas_hq` | HQ가 플랫폼 운영, 파트너에 API 제공 (현재 ICOCARD) |
| `white_label` | 타 운영사에 별도 배포로 통째 판매 |
| `single_tenant` | 단일 운영사 |

- 공개 프로필: `GET /api/package`
- 납품 env 템플릿: [`env.package.example`](env.package.example)
- 상세: [솔루션 패키징](docs/SOLUTION_PACKAGING.md)

## 프로젝트 구조

```
Card-Personal/
├── backend/           # Express + Wirex BaaS 연동
│   └── src/
│       ├── clients/wirex/
│       ├── data/packageManifest.ts
│       ├── services/wirex/
│       └── routes/
├── frontend/
├── docs/
│   └── SOLUTION_PACKAGING.md
├── env.example
└── env.package.example
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| 카드 발급 | Wirex BaaS API (자격증명 설정 시) |
| 카드-월렛 연동 | Unified Balance (WUSD, WEUR) |
| 관리자 페이지 | 사용자/카드/파트너/수수료 |
| KYC | Wirex Hosted KYC |
| 화이트라벨 | 브랜드·도메인·수수료로 타사 납품 |

## 환경 변수

| 변수 | 설명 |
|------|------|
| `USE_MOCK_WIREX` | true=Mock(기본), false=실제 Wirex API |
| `WIREX_CLIENT_ID` | Wirex BaaS 자격증명 |
| `WIREX_WEBHOOK_SECRET` | 웹훅 HMAC |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 관리자 계정 |

## 참고 문서

- [솔루션 패키징 / 화이트라벨 판매](docs/SOLUTION_PACKAGING.md)
- [개발 가이드라인](docs/DEVELOPMENT_GUIDELINES.md)
- [Co-Branded Sandbox 연동](docs/COBRANDED_SANDBOX.md)
- [BaaS 기능 커버리지](docs/BAAS_FEATURE_COVERAGE.md)
- [카페24 가상서버 비즈니스 배포](docs/CAFE24_VPS.md)
- [API 참조](docs/API_REFERENCE.md)
- [아키텍처](docs/ARCHITECTURE.md)
