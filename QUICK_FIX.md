# 빠른 수정 가이드

## 문제
"Supabase credentials not configured" 에러

## 즉시 해결 방법

### Vercel 대시보드에서 환경 변수 설정

1. https://vercel.com 접속
2. 프로젝트 `itsmyturn` 선택
3. **Settings** → **Environment Variables**
4. 다음 4개 추가 (Production, Preview, Development 모두):

```
SUPABASE_URL=여기에_실제_값
SUPABASE_SERVICE_ROLE_KEY=여기에_실제_값
NAVER_CLIENT_ID=여기에_실제_값
NAVER_CLIENT_SECRET=여기에_실제_값
```

5. **Save** 클릭
6. **Redeploy** 클릭 (또는 자동 재배포 대기)

### 값 찾는 방법

- Supabase URL: Supabase 대시보드 > Settings > API > Project URL
- Service Role Key: Supabase 대시보드 > Settings > API > service_role key (⚠️ 비밀!)
- 네이버 API: 네이버 개발자 센터에서 발급

### 확인
재배포 후 브라우저 콘솔에서 에러가 사라지는지 확인
