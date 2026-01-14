# Vercel 환경 변수 설정 가이드

## 문제
에러: "Supabase credentials not configured"

## 원인
Vercel Serverless Function에서는 `VITE_` 접두사가 있는 환경 변수를 사용할 수 없습니다.
`VITE_` 접두사는 프론트엔드 빌드 시에만 사용되고, Serverless Function에는 주입되지 않습니다.

## 해결 방법

### Vercel 대시보드에서 환경 변수 설정

1. Vercel 대시보드 접속: https://vercel.com
2. 프로젝트 선택: `itsmyturn`
3. Settings > Environment Variables 이동
4. 다음 환경 변수 추가 (VITE_ 접두사 없이):

#### 필수 환경 변수
```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
```

#### 선택적 환경 변수
```
ALADIN_TTB_KEY=your-aladin-key (알라딘 API 사용 시)
```

### 환경 변수 이름 규칙

**프론트엔드 (Vite 빌드 시):**
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_ANON_KEY` ✅

**Serverless Function (API):**
- `SUPABASE_URL` ✅ (VITE_ 없이)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (VITE_ 없이)
- `NAVER_CLIENT_ID` ✅
- `NAVER_CLIENT_SECRET` ✅

### 설정 후
1. 환경 변수 추가 후 **재배포 필요**
2. 또는 Vercel이 자동으로 재배포할 때까지 대기

### 확인 방법
Vercel 대시보드 > Functions > search-prices > Logs에서 확인:
- 환경 변수가 제대로 로드되었는지 확인
- 에러 메시지 확인

## 현재 코드
`api/search-prices.ts`는 다음 순서로 환경 변수를 찾습니다:
1. `SUPABASE_URL` (우선)
2. `VITE_SUPABASE_URL` (폴백)

따라서 **`SUPABASE_URL`로 설정하는 것을 권장**합니다.
