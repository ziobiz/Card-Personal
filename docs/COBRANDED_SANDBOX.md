# Co-Branded Visa (Wirex BaaS Sandbox)

이 문서는 [제미나이 초안]과 [공식 문서](https://docs.wirexapp.com/docs/introduction)를 기존 Card-Personal 코드와 비교한 뒤, **기존 앱을 유지하면서** BaaS 연동만 바로잡은 결과입니다.

제품 형태는 [Co-Branded Card](https://www.wirexapp.com/co-branded-card) 와 같이 파트너 브랜드 Visa를 사용자 셀프커스터디 월렛에 붙이는 것입니다.

## 제미나이 vs 공식 vs 현재 구현

| 항목 | 제미나이 초안 | 공식 Wirex BaaS | 이 프로젝트 |
|------|---------------|-----------------|-------------|
| Sandbox Base | `https://api.sandbox...` | **`https://api-baas.wirexapp.tech`** | 동일 (공식) |
| Helper | (모호) | **`https://ramc.wirexapp.tech`** | `SandboxHelperClient` |
| 유저 생성 | `POST /users` | **`POST /api/v2/user`** | `WirexClient.registerUser` |
| 카드 발급 | `POST /cards` | **`POST /api/v2/cards/virtual`**, **`/plastic`** | 동일 |
| 카드 조회/제어 | — | `GET/PUT /api/v1/cards...` | 동일 |
| 인증 | API Key/Secret 막연 | **`POST /api/v1/token`** + `Authorization` + **`X-Chain-Id`** + **`X-User-Wallet`** | 동일 |
| 지갑 | 스마트계약 자동 배포 | **ZeroDev AA + 온체인 Accounts 등록 후** EOA 전달 | 주소만 저장. 배포 SDK는 미구현 |
| 잔액 | — | Unified Balance **WUSD / WEUR** | `GET /api/v1/wallet` |
| 웹훅 | 자체 서버 | **`POST /v2/webhooks/{cards,activities,...}`** (인증 헤더 없음) | `backend/src/routes/webhooks.ts` |
| KYC | Helper로 가상 승인 | Hosted KYC 링크 + Sandbox는 mint로 잔액 확보 | verification-link + Helper mint |

**기존 기능을 버리지 않은 이유:** 사용자 웹, 관리자, 파트너 B2B, 수수료 정책이 이미 동작합니다. 새로 그린필드 프로젝트를 만들면 그 레이어가 사라집니다. 대신 `clients/wirex/` 를 공식 스펙에 맞춰 넣고, 라우트만 연결했습니다.

## Sandbox 자격증명 (문서 2026-04)

미설정 시 `backend/src/config.ts` 기본값:

- `client_id`: `3fCeoWq6FOtKJBZiyorXnxE41Dqp2zKB`
- Chain: Base Sepolia **84532**
- WUSD: `0x0774164DC20524Bb239b39D1DC42573C3E4C6976`
- partner_id: `0x00000000000000000000000000000044`

전용 키가 있으면 `.env` 의 `WIREX_CLIENT_ID` / `WIREX_CLIENT_SECRET` 로 덮어씁니다.

## 디렉터리 (요청하신 레이어)

```
backend/src/
  clients/wirex/          # WirexClient, SandboxHelperClient, types
  routes/                 # cards, sandbox, webhooks, auth, admin, partner
  services/wirex/         # wirexService (Mock 폴백) + wirexBaaSClient 래퍼
  data/                   # users, webhooks 로그, 파트너, 수수료
  scripts/test-flow.ts    # CLI 통합 플로우
```

## 권장 테스트 순서

1. **Mock (기본)**  
   `USE_MOCK_WIREX=true`  
   `cd backend && npm run test:flow`

2. **Live Sandbox**  
   - Wirex 대시보드에서 웹훅 URL 을 이 서버의 `https://<host>/v2/webhooks/...` 로 등록  
   - ZeroDev로 AA 월렛 배포 후 Accounts 컨트랙트에 EOA 등록 (공식 Getting Started)  
   - `USE_MOCK_WIREX=false`  
   - 회원가입 시 `wallet_address` 전달, 또는 `PUT /api/user/wallet`  
   - `WALLET_ADDRESS=0x... npm run test:flow`

3. Helper (잔액·결제 시뮬레이션, 인증 헤더 없음)  
   - `POST /api/sandbox/mint` — WUSD 민트  
   - `POST /api/sandbox/card-purchase` — ISO 승인+정산 → `/v2/webhooks/activities`  
   - `POST /api/sandbox/sepa-deposit`

4. 앱 API  
   - `POST /api/cards/virtual`  
   - `POST /api/cards/plastic`  
   - `PUT /api/cards/:id/block|unblock|activate|limit`

## Live 모드에서 Mock으로 떨어지는 경우

`POST /api/v2/user` 는 **온체인에 이미 등록된** `wallet_address` 가 필요합니다. 주소가 없거나 BaaS가 실패하면 `wirexService` 가 Mock 유저/카드를 만듭니다. 실제 Visa 발급을 보려면 Admin 설정에서 Mock 을 끄고 유효한 월렛을 연결하세요.

## 아직 하지 않은 것

- ZeroDev SDK로 AA 월렛 자동 배포
- Production Base (`api-baas.wirexapp.com`, chain 8453)
- 웹훅 HMAC 알고리즘이 문서와 1:1인지 실키로 검증 (시크릿 비어 있으면 통과)

## 관련 코드

- `backend/src/clients/wirex/WirexClient.ts`
- `backend/src/clients/wirex/SandboxHelperClient.ts`
- `backend/src/scripts/test-flow.ts`
