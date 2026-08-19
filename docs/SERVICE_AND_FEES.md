# 서비스 정의 및 수수료 정책

## 1. 고객 서비스 (직접 제공)

| No | 서비스 | API/기능 |
|----|--------|----------|
| 1 | 카드 발급 | POST /api/cards/virtual |
| 2 | 카드 충전 | POST /api/wallet/card/:cardId/deposit |
| 3 | 잔액 조회 | GET /api/wallet/balance |
| 4 | 개인 간 거래 (월렛→월렛) | POST /api/wallet/p2p |
| 5 | 충전 후 본인 계좌 환불 | POST /api/wallet/refund |
| 6 | 거래 내역 조회 | GET /api/wallet/transactions |
| 7 | 카드 사용 성공/실패 내역 | GET /api/wallet/card/:cardId/usage |
| 8 | 카드 동결/해제 | PUT /api/cards/:cardId/freeze, unfreeze |

## 2. 파트너 API 기능

| No | API | 경로 |
|----|-----|------|
| 1 | 카드 발급 | POST /api/partner/v1/cards/virtual |
| 2 | 카드 충전 | POST /api/partner/v1/wallet/card/:cardId/deposit |
| 3 | 잔액 조회 | GET /api/partner/v1/wallet/balance |
| 4 | 개인 간 거래 | POST /api/partner/v1/wallet/p2p |
| 5 | 총액 충전 후 계좌 환불 | POST /api/partner/v1/wallet/refund |
| 6 | 거래 내역 조회 | GET /api/partner/v1/wallet/transactions |
| 7 | 카드 사용 성공/실패 | (transaction type: card_usage) |
| 8 | 카드 동결/해제 | PUT /api/partner/v1/cards/:cardId/freeze, unfreeze |

## 3. 수수료 정책

모든 충전 관련 API 사용 시 수수료가 **재무 월렛 주소**로 자동 이체됩니다.

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 재무 월렛 주소 | 수수료 수령 주소 (관리자 설정) | - |
| 카드 발급 비용 | 발급 시 월렛에서 차감 | 5 USD |
| 카드 충전 수수료 | 충전 금액의 % | 0.5% |
| 카드 사용 건당 수수료 | 결제 성공 시 차감 | 0.1 USD |
| 카드 월간 이용료 | 카드당 월 1회 | 2 USD |
| 파트너 월간 API 이용료 | 파트너당 월 1회 | 50 USD |

## 4. 파트너 과금 (월간 API 이용료)

파트너마다 **개별 요금**을 둘 수 있습니다. 미설정 시 관리자 전역 기본값을 씁니다.

1. 파트너는 **대표 월렛 주소**를 등록
2. 매월 해당 파트너의 `partnerMonthlyFee` 청구 → 재무 월렛으로 이체
3. 미납 시:
   - 1차 경고
   - 2차 경고
   - **월렛 사용 중지** (API 호출 불가)

4. 관리자에서:
   - 파트너 API → **요금**에서 파트너별 발급/충전/월 이용료 설정
   - "월간 청구 실행" 버튼으로 수동 실행 (cron 연동 가능)
   - 테스트 잔액 충전으로 시뮬레이션
