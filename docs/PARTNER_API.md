# 파트너 API 문서

타 업체가 우리 시스템을 통해 개인 카드 발급·지갑 연동 서비스를 제공할 수 있도록 하는 API입니다.

## 파트너 포털 로그인

본사 **업체등록** / **조직등록** 시 대표 ID·비밀번호를 발급합니다.

- 가맹점: `https://.../partner/login` ([TINPASS](https://www.tinpass.com/login) 와 같은 사칭 안내 + 이메일/비밀번호)
- 최초 로그인 시 비밀번호 재설정
- OTP: 구현되어 있으며 기본 비활성. 조직 OTP는 `OTP_REQUIRED_ORG=true`, 회원 OTP는 `OTP_REQUIRED_MEMBER=true`

회원(`/login`) OTP는 코드가 있으나 기본 꺼져 있습니다.


| Header | 설명 |
|--------|------|
| `X-API-Key` | 관리자에서 발급받은 API Key |
| `Authorization` | `Bearer <api_key>` (대안) |

## 사용자 식별

파트너의 각 최종 사용자를 구분하기 위해 **X-Partner-User-Id** 가 필수입니다.

| Header | 설명 |
|--------|------|
| `X-Partner-User-Id` | 파트너 측 사용자 고유 ID |

또는 요청 body/query에 `partner_user_id` 포함 가능.

---

## 1. 카드 발급 API

Base: `/api/partner/v1/cards`

### 카드 목록 조회
```
GET /api/partner/v1/cards
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>

Query: ?page=1&size=10
```

### 가상 카드 발급
```
POST /api/partner/v1/cards/virtual
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
Content-Type: application/json

{
  "limit": 5000,
  "currency": "USD"
}
```

### 실물 Co-Branded 카드 발급
```
POST /api/partner/v1/cards/plastic
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
Content-Type: application/json

{
  "card_name": "Partner Visa",
  "name_on_card": "HONG GILDONG"
}
```

### 카드 차단
```
PUT /api/partner/v1/cards/:cardId/block
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
```

### 카드 차단 해제
```
PUT /api/partner/v1/cards/:cardId/unblock
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
```

### 카드 한도 설정
```
PUT /api/partner/v1/cards/:cardId/limit
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
Content-Type: application/json

{
  "limit": 3000
}
```

---

## 2. 지갑 연동 API

Base: `/api/partner/v1/wallet`

### 잔액 조회
```
GET /api/partner/v1/wallet/balance
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
```

**응답:**
```json
{
  "primary": [{"symbol": "WUSD", "balance": 1000, ...}],
  "cardSummaries": [{"cardId": "...", "panLast4": "1234", "balance": 50, "currency": "USD"}]
}
```

### 지원 토큰 목록
```
GET /api/partner/v1/wallet/tokens
X-API-Key: <api_key>
```

### 카드 충전 정보
```
GET /api/partner/v1/wallet/card/:cardId/deposit-info
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
```

### 카드 충전
```
POST /api/partner/v1/wallet/card/:cardId/deposit
X-API-Key: <api_key>
X-Partner-User-Id: <파트너_사용자_ID>
Content-Type: application/json

{
  "amount": 100,
  "token": "USDT"
}
```

---

## 관리자에서 파트너 등록

1. 관리자 로그인 → **파트너 API** 메뉴
2. **파트너 추가** → 파트너명, 회사명 입력
3. 발급된 **API Key** 저장 (한 번만 표시됨)
4. 파트너사에게 API Key 및 Base URL 전달

파트너는 **가맹점**입니다. 가상/실물 카드 허용 여부는 업체 등록 시 지정합니다. 실물: `POST /api/partner/v1/cards/plastic`.
