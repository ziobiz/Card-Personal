# Wirex Card Personal - 개인용 카드 발급

**개인용** 카드 발급 웹 서비스입니다.  
[Wirex BaaS API](https://docs.wirexapp.com) 연동, 관리자 페이지, KYC 플로우 지원.

> [id.wirexapp.com](https://id.wirexapp.com/login) 스타일 참조

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
- **기본 계정**: admin@wirexcard.local / admin123
- 사용자·카드 목록, 통계 대시보드
- **파트너 API 관리**: 타 업체 연동용 API Key 발급·관리

### 5. 파트너 API (타 업체 연동)

계약된 업체가 자체 사이트에서 우리 API로 카드 발급·지갑 연동을 제공할 수 있습니다.

- **1. 카드 발급 API**: 목록, 발급, 차단, 한도 설정
- **2. 지갑 연동 API**: 잔액, 충전, 토큰 목록

→ [파트너 API 문서](docs/PARTNER_API.md)

## 프로젝트 구조

```
Card-Personal/
├── backend/           # Express + Wirex BaaS 연동
│   └── src/
│       ├── services/wirex/
│       │   ├── wirexBaaSClient.ts   # 실제 Wirex API 클라이언트
│       │   ├── wirexService.ts     # Real + Mock 통합
│       │   └── mockWirex.ts        # Mock (개발용)
│       └── routes/
│           ├── admin.ts            # 관리자 API
│           └── kyc.ts              # KYC 검증 링크
├── frontend/          # React + Vite (사용자 + 관리자)
│   └── src/
│       ├── pages/admin/            # 관리자 페이지
│       └── pages/                  # 카드 사용자 페이지
├── docs/
└── env.example
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| 카드 발급 | Wirex BaaS API를 통한 실제 카드 발급 (자격증명 설정 시) |
| 카드-월렛 연동 | Unified Balance (WUSD, WEUR) ↔ 카드 충전 |
| 관리자 페이지 | 사용자/카드 목록, 통계 대시보드 |
| KYC | Wirex Hosted KYC 검증 링크 (SumSub 리다이렉트) |

## 환경 변수 (env.example 참고)

| 변수 | 설명 |
|------|------|
| `USE_MOCK_WIREX` | true=Mock(기본), false=실제 Wirex API |
| `WIREX_CLIENT_ID` | Wirex BaaS 자격증명 (미설정 시 Sandbox 공개 키 사용) |
| `ADMIN_EMAIL` | 관리자 이메일 (기본: admin@wirexcard.local) |
| `ADMIN_PASSWORD` | 관리자 비밀번호 (기본: admin123) |

## 참고 문서

- [Wirex KYC Hosted](https://docs.wirexapp.com/docs/kyc-hosted)
- [Wirex Authentication](https://docs.wirexapp.com/docs/authentication)
- [Wirex Onboarding](https://docs.wirexapp.com/docs/onboarding)
- [API 참조](docs/API_REFERENCE.md)
- [아키텍처](docs/ARCHITECTURE.md)
