# Solution Packaging (ICOCARD)

Wirex BaaS 카드 발급 스택을 **다른 업체에 판매 가능한 솔루션 패키지**로 운영하기 위한 기준 문서입니다.

> Sandbox 전용 API Key는 Wirex 발급 후에 실연동합니다. 그 전까지 Mock 유지.

## 1. 판매 구조 (3계층)

```text
┌─────────────────────────────────────────────────────────┐
│  Platform / Package (본 코드베이스)                       │
│  - Wirex BaaS 연동 엔진                                  │
│  - 회원앱 / 관리자 / 파트너API / 웹훅                     │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Operator A          Operator B          Operator C
   (화이트라벨 구매사)   (화이트라벨 구매사)   (또는 HQ SaaS)
   brand / domain       brand / domain
        │
        ├── Partner / Merchant 1 (API Key)
        ├── Partner / Merchant 2
        └── Direct members (회원앱)
```

| 계층 | 역할 | 예시 |
|------|------|------|
| **Package** | 판매 가능한 소프트웨어 | ICOCARD-BAAS-PACK |
| **Operator** | 패키지를 도입한 운영사 | ONTHELINE, 타 브랜드사 |
| **Partner/Merchant** | 운영사 아래 API 고객 | 앱/쇼핑몰 제휴사 |

## 2. 패키지 모드

| mode | 용도 |
|------|------|
| `saas_hq` | HQ(ONTHELINE)가 플랫폼 운영, 파트너에 API 재판매 |
| `white_label` | 타 업체에 **별도 배포**로 통째 판매 (브랜드·도메인·관리자 독립) |
| `single_tenant` | 단일 운영사만, 파트너 재판매 최소화 |

현재 ICOCARD 운영 기본값: `saas_hq`  
타사 납품 시: 인스턴스를 분리하고 `white_label` + 브랜드/도메인 교체.

## 3. 화이트라벨로 바꾸는 것 (코드 수정 없이)

1. **Admin → Brand**  
   productName / operatorName / logo / copyright / colors  
2. **Package domains** (`GET/PUT /api/admin/package`)  
   member / admin / partner / api URL  
3. **Webhook base URL**  
   구매사 도메인 예: `https://api.buyer-brand.com`  
4. **환경변수** (`env.package.example`)  
   JWT, admin 계정, (키 수령 후) Wirex credentials  
5. **수수료 정책**  
   HQ / Partner fee templates

Wirex 클라이언트·카드·웹훅 코어는 **브랜드와 분리**되어 있어야 합니다.  
(이미 `brandStore` / `packageManifest` / `WirexClient` 분리)

## 4. 배포 패키지 산출물

납품 시 최소 구성:

- `backend/` + `frontend/` 빌드
- `env.package.example` → 구매사 `.env`
- Webhook: `{API_DOMAIN}/v2/webhooks/*`
- 관리자 최초 계정 / OTP 시크릿 전달 절차
- 파트너 API 매뉴얼 (`docs/PARTNER_API.md`)
- 본 문서 + `GET /api/package` 상태 확인

## 5. Wirex 키 정책 (중요)

| 단계 | 상태 |
|------|------|
| 지금 | Mock 유지, webhook URL만 Wirex에 제공 |
| Sandbox key 수령 후 | 해당 **배포 인스턴스**에 key 주입, `USE_MOCK_WIREX=false` |
| Production | 별도 production key + chain 8453 |

**원칙:** 구매사마다 Wirex 자격증명·webhook URL은 **배포 단위로 분리**.  
한 인스턴스에 여러 Operator의 Wirex key를 섞지 않음 (초기 판매 모델).

향후 SaaS 단일 인스턴스 멀티 Operator가 필요하면 `operatorId → wirexCredentials` 맵을 추가한다 (로드맵).

## 6. 개발 시 필수 고려사항

1. 새 UI 문구 → **i18n** (KO/EN/JA/ZH/TH)  
2. 브랜드/상품명 → `brandStore` / `t()` 사용, `ICOCARD` 하드코딩 금지  
3. 카드·지갑·KYC → Wirex 공식 path만, Gemini 추측 path 금지  
4. 파트너 데이터 → 반드시 `partnerId` 스코프  
5. 수수료/정산 → HQ 정책 템플릿 + partner override  
6. Sandbox 실연동은 **전용 key 수령 후**만

## 7. API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/package` | 공개 패키지 프로필 |
| GET | `/api/admin/package` | 관리자 패키지 조회 |
| PUT | `/api/admin/package` | 모드/도메인/모듈 업데이트 |
| GET | `/api/brand` | 화이트라벨 브랜드 |
| GET | `/api/catalog` | 기능 카탈로그 + package |

## 8. 판매 체크리스트 (납품)

- [ ] `mode=white_label` 또는 계약 모드 설정
- [ ] 브랜드/로고/카피라이트 교체
- [ ] 도메인 4종(SSL) 연결
- [ ] Webhook base URL을 Wirex에 등록
- [ ] Sandbox key 주입 (수령 후)
- [ ] Mock off + 온체인 지갑/KYC/카드 스모크 테스트
- [ ] 관리자·파트너 계정 핸드오버
- [ ] 수수료/약관 확정

## 9. 현재 ICOCARD (ONTHELINE) 기본값

- Member: `https://icocard.net`
- Admin: `https://admin.icocard.net`
- Partner: `https://partner.icocard.net`
- API / Webhook base: `https://api.icocard.net`
- Product code: `ICOCARD-BAAS-PACK`

## 10. ASP / 제3자 임대·납품

본 패키지는 **직접 운영(SaaS HQ)** 과 **ASP 임대/화이트라벨 납품**을 동시에 고려합니다.

| 구성 요소 | 분리 단위 | 비고 |
|-----------|-----------|------|
| 브랜드·로고·색 | `brandStore` | 테넌트별 Admin → Brand |
| **활성 언어** | `brand.enabledLocales` | 번역은 전체 유지, 서비스 노출만 선택 |
| Wirex 키·Webhook | 배포 인스턴스 `.env` | 구매사/테넌트별 분리 |
| 파트너 API·수수료 | Partner / Fee modules | 모듈 유지 |
| Sandbox 점검 | Admin → Sandbox | `GET/POST /api/admin/sandbox/*` |

### 언어 활성화 (본사 설정)

1. Admin → 브랜드/플랫폼 → **서비스 언어** 칩 선택  
2. 기본 언어 지정  
3. 회원/파트너 `LanguageSwitcher`는 활성 언어만 표시  

### Sandbox 스모크

1. Admin → Sandbox 연동 → 토큰 상태 확인  
2. Wirex Accounts에 등록된 EOA 입력 후 스모크 실행  
3. 순서: token → registerUser → mint → issueVirtualCard  

ZeroDev AA 자동배포 SDK는 별도 모듈로 확장 예정입니다. 현재는 등록된 EOA를 입력받아 검증합니다.
