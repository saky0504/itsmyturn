# 한 시간마다 실행되는 동기화 작업 설정 가이드

## 개요

이 시스템은 한 시간마다 자동으로 다음 작업을 수행합니다:

1. **Discogs에서 추가로 20개의 앨범을 가져온다**
   - 기존 앨범은 유지하고 새로운 앨범만 추가
   - 중복 방지 (discogs_id 기준)

2. **전체 앨범 정보에 가격 정보를 확인하여 UI에 반영한다**
   - 모든 쇼핑몰에서 가격 정보 수집
   - Supabase의 `lp_offers` 테이블에 저장

3. **존재하는 가격정보를 적용한다**
   - 가격 정보가 UI에 자동으로 반영됨

## 실행 방법

### 수동 실행

```bash
npm run hourly-sync
```

### 자동 실행 (스케줄러)

두 가지 방법 중 하나를 선택할 수 있습니다:

#### 방법 1: Vercel Cron (권장)

Vercel에 배포된 경우, `vercel.json`에 cron 설정이 포함되어 있습니다.

**설정 확인:**
- `vercel.json`의 `crons` 섹션 확인
- API 라우트: `/api/hourly-sync`

**환경변수 설정 (Vercel Dashboard):**
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DISCOGS_TOKEN=your_discogs_token
DISCOGS_CONSUMER_KEY=your_consumer_key (선택사항)
DISCOGS_CONSUMER_SECRET=your_consumer_secret (선택사항)
CRON_SECRET=your_secret_key (선택사항, 보안 강화용)
```

**보안:**
- `CRON_SECRET`을 설정하면 인증이 필요합니다
- Vercel Cron은 자동으로 `Authorization: Bearer {CRON_SECRET}` 헤더를 추가합니다

#### 방법 2: GitHub Actions

GitHub 저장소에 `.github/workflows/hourly-sync.yml` 파일이 있습니다.

**설정 확인:**
- GitHub Actions가 활성화되어 있는지 확인
- Secrets에 다음 환경변수 추가:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VITE_SUPABASE_URL` (선택사항)
  - `VITE_SUPABASE_SERVICE_ROLE_KEY` (선택사항)
  - `DISCOGS_TOKEN`
  - `DISCOGS_CONSUMER_KEY` (선택사항)
  - `DISCOGS_CONSUMER_SECRET` (선택사항)
  - `DISCOGS_USER_AGENT` (선택사항)

**GitHub Secrets 설정 방법:**
1. GitHub 저장소로 이동
2. Settings > Secrets and variables > Actions
3. "New repository secret" 클릭
4. 각 환경변수 추가

**수동 실행:**
- GitHub Actions 탭에서 "Hourly LP Data Sync" 워크플로우 선택
- "Run workflow" 버튼 클릭

## 스크립트 구조

### `scripts/hourly-sync.ts`
통합 동기화 스크립트로 다음을 순차적으로 실행:
1. `fetchAndStoreRealLpData()` - Discogs 앨범 가져오기
2. `syncAllProducts()` - 가격 정보 동기화

### `scripts/fetch-real-lp-data.ts`
- Discogs API에서 인기 LP 20개 검색
- 기존 앨범과 중복 확인
- 새로운 앨범만 Supabase에 추가

### `scripts/sync-lp-data.ts`
- 모든 앨범의 가격 정보 수집
- 각 쇼핑몰에서 크롤링
- `lp_offers` 테이블에 저장

## 모니터링

### 로그 확인

**Vercel:**
- Vercel Dashboard > Functions > `/api/hourly-sync` > Logs

**GitHub Actions:**
- GitHub 저장소 > Actions 탭 > "Hourly LP Data Sync" > 실행 기록

### 성공/실패 알림

**GitHub Actions:**
- 실패 시 자동으로 GitHub Issue 생성
- 이메일 알림 설정 가능 (GitHub Settings)

**Vercel:**
- Vercel Dashboard에서 함수 실행 상태 확인
- 알림 설정 가능 (Vercel Settings)

## 문제 해결

### 스크립트가 실행되지 않는 경우

1. **환경변수 확인**
   ```bash
   # 로컬에서 테스트
   npm run hourly-sync
   ```

2. **스케줄러 확인**
   - Vercel: `vercel.json`의 `crons` 설정 확인
   - GitHub Actions: `.github/workflows/hourly-sync.yml` 확인

3. **권한 확인**
   - Supabase Service Role Key가 올바른지 확인
   - Discogs API 토큰이 유효한지 확인

### 가격 정보가 수집되지 않는 경우

1. **크롤링 로그 확인**
   - 각 쇼핑몰별 에러 메시지 확인
   - HTML 구조 변경 가능성 확인

2. **Rate Limiting**
   - 각 쇼핑몰의 요청 제한 확인
   - 딜레이 시간 조정 필요할 수 있음

### 앨범이 중복 추가되는 경우

- `discogs_id`가 올바르게 저장되는지 확인
- Supabase의 `lp_products` 테이블에 `discogs_id` 인덱스 확인

## 성능 최적화

### 실행 시간 단축

- 병렬 처리: 가격 수집은 이미 병렬로 처리됨
- 배치 크기 조정: 한 번에 가져올 앨범 수 조정 가능

### 비용 최적화

- 불필요한 요청 최소화
- 캐싱 전략 고려 (향후 구현)

## 다음 단계

1. **알림 시스템 추가**
   - Slack, Discord, 이메일 알림
   - 실패 시 즉시 알림

2. **대시보드 구축**
   - 동기화 상태 모니터링
   - 통계 및 메트릭 표시

3. **에러 복구**
   - 자동 재시도 로직
   - 부분 실패 처리

