# Wirex Card Personal - 개인용 카드 발급

**개인용** 카드 발급 웹 서비스입니다.  
1인 1계정, 가상 카드 발급, 지갑 충전, 일일 한도 관리.

> 배포 시 **별도 도메인** 사용 (예: card-personal.example.com)

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

### 3. 사용

1. 회원가입 → 로그인
2. 가상 카드 발급 (1인당 복수 카드 가능)
3. 카드 충전, 일일 한도 설정, 차단/해제

## 프로젝트 구조

```
Card-Personal/
├── backend/     # Express + Mock Wirex (가상 카드, 일일 한도)
├── frontend/    # React + Vite
├── docs/
└── samples/
```

## 개인용 전용 기능

- 가상 카드만 발급 (물리 카드 없음)
- 일일 한도 (매일 00:00 리셋)
- 지갑 충전 → 카드 결제
- 본인 계좌 송금 (Wirex 정책 준수)

## 다국어

12개 언어 지원 (ko, en, ja, th, id, vi, ms, fil, hi, my, km, lo)

## 참고

- [API 참조](docs/API_REFERENCE.md)
- [아키텍처](docs/ARCHITECTURE.md)
