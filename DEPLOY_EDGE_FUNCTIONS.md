# Supabase Edge Functions 배포 가이드

## 문제
Supabase Edge Functions는 Vercel에 배포되지 않습니다. Supabase CLI를 사용하여 별도로 배포해야 합니다.

## 배포 방법

### 1. Supabase CLI 로그인
```bash
npx supabase login
```

### 2. 프로젝트 연결
```bash
# Supabase 대시보드에서 프로젝트 참조 ID 확인
# URL 예: https://abcdefghijklmnop.supabase.co
# 프로젝트 참조 ID: abcdefghijklmnop

npx supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Edge Function 배포
```bash
# search-prices 함수 배포
npx supabase functions deploy search-prices

# 환경 변수 설정 (Supabase 대시보드에서도 가능)
npx supabase secrets set NAVER_CLIENT_ID=your_naver_client_id
npx supabase secrets set NAVER_CLIENT_SECRET=your_naver_client_secret
npx supabase secrets set ALADIN_TTB_KEY=your_aladin_ttb_key
```

## 환경 변수 확인
Supabase 대시보드 > Project Settings > Edge Functions > Secrets에서 확인/설정 가능합니다.

## 자동 배포 (선택사항)
GitHub Actions를 사용하여 자동 배포할 수 있습니다.
