# Co-Branded API 기능 커버리지

마케팅/요구사항 항목을 공식 Wirex BaaS 경로와 이 서버 API에 매핑한 표입니다.

| 요구 기능 | Wirex 공식 | 이 시스템 |
|-----------|------------|-----------|
| 가상 Visa 발급 | `POST /api/v2/cards/virtual` | `POST /api/cards/virtual` |
| 실물 Visa 발급 | `POST /api/v2/cards/plastic` | `POST /api/cards/plastic` |
| Apple Pay / Google Pay 토큰 | Visa MDES/VTS (OpenAPI 전용 경로 없음 → 시도 후 로컬 DPAN) | `POST /api/cards/:id/wallet-tokens` `{ wallet: apple_pay\|google_pay }` |
| 사용자 온보딩 | `POST /api/v2/user` | `POST /api/auth/register` + `PUT /api/user/wallet` |
| KYC/AML | Hosted link / SumSub token / sharing token | `GET /api/kyc/verification-link`, `/verification-token`, `POST /sharing-token`, `GET /status` |
| Travel Rule | 송금 recipient PII + `GET /api/v1/validation/rules` | `POST /api/compliance/travel-rule/validate` (기본 임계 $1000) |
| 웹훅 승인/거절/환불/카드상태 | `/v2/webhooks/activities\|cards\|3ds\|user` | 동일 경로 수신, ISO 원장 기록 |
| 3DS | `GET/POST .../cards/3ds/requests` | `GET /api/cards/3ds/requests`, `POST .../approve\|decline` |
| 정산·명세서 | `GET /api/v2/activity/feed`, `POST /api/v1/activity/statement/full` | `GET /api/activities`, `GET /api/reporting/statement` |
| ISO 조정 | Activity operations + on-chain hash | `GET /api/reporting/reconciliation` (MTI 0100/0200/0420) |
| 멀티 테넌트 | Wirex partner credentials | `/api/partner/v1/*` + API Key + 분당 rate limit |
| Sandbox | `api-baas.wirexapp.tech` + Helper `ramc.wirexapp.tech` | `WIREX_ENV=sandbox` |
| Production | `api-baas.wirexapp.com` chain 8453, Helper 없음 | `WIREX_ENV=production` / 관리자 환경 선택 |

카탈로그: `GET /api/catalog`, `GET /health`
