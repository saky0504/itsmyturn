# 크롤링 관련 파일 정리

이 문서는 LP 마켓에서 사용하는 크롤링 및 데이터 수집 관련 파일들의 목록과 역할을 정리합니다.

## 📋 목차

1. [메인 크롤링 스크립트](#메인-크롤링-스크립트)
2. [데이터 수집 스크립트](#데이터-수집-스크립트)
3. [데이터 정리/클린업 스크립트](#데이터-정리클린업-스크립트)
4. [검증/분석 스크립트](#검증분석-스크립트)
5. [디버깅/인스펙션 스크립트](#디버깅인스펙션-스크립트)

---

## 메인 크롤링 스크립트

### `scripts/sync-lp-data.ts`
**역할**: 각 판매처에서 LP 가격 및 재고 정보를 수집하여 Supabase에 저장

**주요 기능**:
- 8개 판매처에서 가격 정보 수집 (YES24, 알라딘, 교보문고, 인터파크, 네이버, 향뮤직, 김밥레코드, 마장뮤직)
- `collectPricesForProduct()`: 제품별로 모든 판매처에서 가격 수집
- `syncAllProducts()`: DB의 모든 제품에 대해 가격 동기화 (기본 1000개 제한)
- `isValidLpMatch()`: 수집된 데이터가 실제 LP인지 검증 (현재 70% 매칭 기준)
- `isValidPrice()`: 가격 유효성 검사 (20,000원 ~ 1,000,000원)

**사용하는 API/크롤링**:
- 네이버 쇼핑 API (`fetchNaverPrice`)
- 알라딘 Open API (`fetchAladinPrice`)
- YES24 HTML 크롤링 (`fetchYes24Price`)
- 교보문고 HTML 크롤링 (`fetchKyoboPrice`)
- 인터파크 HTML 크롤링 (`fetchInterparkPrice`)
- Discogs API (`fetchDiscogsInfo`)

**문제점**:
- `Promise.all`로 8개 판매처 동시 호출 → API 호출 폭탄
- 제품당 8개 API 호출, 1000개 제품 = 8000개 호출
- 딜레이 2초만으로는 rate limit 위반
- 필터링이 약함 (70% 매칭만 요구)

**실행 방법**:
```bash
npm run sync-lp-prices
# 또는
tsx scripts/sync-lp-data.ts
```

---

### `scripts/hourly-sync.ts`
**역할**: 한 시간마다 실행되는 통합 동기화 스크립트 (메인 스케줄러)

**주요 기능**:
1. 한국 가요/LP 신규 데이터 발굴 (Aladin) - `discoverKoreanLPs()`
2. Discogs에서 추가 앨범 데이터 수집 - `fetchAndStoreRealLpData()`
3. 전체 앨범 가격 정보 동기화 - `syncAllProducts()`
4. 데이터 정제 작업 - `cleanupBadProducts()`, `cleanupBadOffers()`, `cleanupDuplicateOffers()`

**실행 주기**: 1시간마다 (Vercel Cron, GitHub Actions, Supabase Edge Function)

**문제점**:
- 모든 작업을 한 번에 실행하여 API 호출 폭탄 발생
- 에러 발생 시에도 계속 진행하여 rate limit 위반 가능

**실행 방법**:
```bash
npm run hourly-sync
# 또는
tsx scripts/hourly-sync.ts
```

---

## 데이터 수집 스크립트

### `scripts/fetch-real-lp-data.ts`
**역할**: Discogs API를 사용하여 인기 LP를 가져와 Supabase에 저장

**주요 기능**:
- Discogs API에서 LP 검색 (다양한 전략 사용)
- 검색 결과를 Supabase `lp_products` 테이블에 저장
- 포맷 필터링 (Vinyl/LP만 허용, CD 제외)
- 중복 체크 (Discogs ID 기반)

**사용하는 API**:
- Discogs API (`https://api.discogs.com/database/search`)
- OAuth 1.0a 또는 Personal Access Token 인증

**문제점**:
- 검색 결과만으로 저장 (상세 API 호출 없음) → 아티스트/제목 부정확
- 제목에서 ` - `로만 아티스트 분리 → 부정확한 파싱
- 10페이지씩 처리하여 API 호출 과다

**실행 방법**:
```bash
npm run fetch-lp-data
# 또는
tsx scripts/fetch-real-lp-data.ts
```

---

### `scripts/discover-korean-lps.ts`
**역할**: 알라딘 API를 사용하여 한국 가요/LP를 발굴하여 Supabase에 저장

**주요 기능**:
- 알라딘 Open API로 신간/베스트셀러 LP 검색
- 키워드 검색 (가요 LP, 바이닐, 한국 인디 LP 등)
- 필터링 (LP 키워드 필수, 가격 15,000원 이상)
- EAN 기반 중복 체크

**사용하는 API**:
- 알라딘 Open API (`http://www.aladin.co.kr/ttb/api/ItemList.aspx`)
- 환경변수: `ALADIN_TTB_KEY` 필요

**문제점**:
- 5페이지씩 처리 (신간 5페이지 + 베스트셀러 5페이지)
- 키워드 검색 8개 → API 호출 과다
- 딜레이 1초만으로는 부족

**실행 방법**:
```bash
tsx scripts/discover-korean-lps.ts
```

---

## 데이터 정리/클린업 스크립트

### `scripts/cleanup.ts`
**역할**: 잘못된 상품 및 가격 정보를 제거하는 정리 스크립트

**주요 함수**:
- `cleanupBadProducts()`: LP가 아닌 상품 제거 (CD, 포스터, 굿즈 등)
- `cleanupBadOffers()`: 비정상적으로 저렴한 가격 제거 (< 15,000원)
- `cleanupDuplicateOffers()`: 중복된 가격 정보 제거 (URL 기반)
- `cleanupMissingData()`: 제목/아티스트가 없는 상품 제거

**실행 방법**:
```typescript
import { cleanupBadProducts, cleanupBadOffers, cleanupDuplicateOffers } from './cleanup';
await cleanupBadProducts();
await cleanupBadOffers();
await cleanupDuplicateOffers();
```

---

### `scripts/deduplicate-offers.ts`
**역할**: 중복된 가격 정보를 제거하는 스크립트

**주요 기능**:
- `product_id` + `url` 조합으로 중복 체크
- 가장 오래된 레코드만 유지, 나머지 삭제

**실행 방법**:
```bash
tsx scripts/deduplicate-offers.ts
```

---

### `scripts/run-strict-cleanup.ts`
**역할**: 엄격한 기준으로 데이터 정리

**실행 방법**:
```bash
tsx scripts/run-strict-cleanup.ts
```

---

### `scripts/purge-kyobo-data.ts`, `scripts/purge-kyobo-robust.ts`
**역할**: 교보문고 관련 잘못된 데이터 일괄 삭제

---

### `scripts/nuke-all-offers.ts`
**역할**: 모든 가격 정보 일괄 삭제 (주의!)

---

## 검증/분석 스크립트

### `scripts/analyze-duplicate-urls.ts`
**역할**: 중복 URL 분석

### `scripts/analyze-internal-duplicates.ts`
**역할**: 내부 중복 데이터 분석

### `scripts/analyze-success-rate.ts`
**역할**: 크롤링 성공률 분석

### `scripts/check-sync-status.ts`
**역할**: 동기화 상태 확인

### `scripts/check-naver-dup.ts`
**역할**: 네이버 중복 데이터 확인

### `scripts/check-kyobo-dup.ts`
**역할**: 교보문고 중복 데이터 확인

### `scripts/check-weight-scale.ts`
**역할**: 체중계 관련 잘못된 데이터 확인

---

## 디버깅/인스펙션 스크립트

### `scripts/inspect-yes24.ts`
**역할**: YES24 크롤링 디버깅

### `scripts/inspect-kyobo-db.ts`
**역할**: 교보문고 DB 데이터 확인

### `scripts/inspect-coupang-url.ts`
**역할**: 쿠팡 URL 검증

### `scripts/inspect-user-urls.ts`
**역할**: 사용자 URL 검증

### `scripts/inspect-remaining-offers.ts`
**역할**: 남아있는 가격 정보 확인

### `scripts/test-one-sync.ts`
**역할**: 단일 제품 동기화 테스트

### `scripts/test-single.ts`
**역할**: 단일 테스트

---

## API/크롤링 대상 판매처

### ✅ 정상 작동
- **알라딘**: Open API 사용 (안정적)
- **네이버 쇼핑**: API 사용 (안정적, 단 rate limit 주의)

### ⚠️ 문제 있음
- **YES24**: HTML 크롤링, 구조 변경 시 실패 가능
- **교보문고**: HTML 크롤링, 구조 변경 시 실패 가능
- **인터파크**: 타임아웃 문제

### ❌ 차단됨
- **쿠팡**: 봇 차단 (puppeteer 필요)
- **11번가**: 검색어 개선 필요

### ⚠️ 미확인
- **향뮤직**: 타임아웃 문제
- **김밥레코드**: 사이트 구조 확인 필요
- **마장뮤직앤픽쳐스**: 사이트 구조 확인 필요

---

## 환경 변수

크롤링 스크립트 실행에 필요한 환경 변수:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 네이버 쇼핑 API
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret

# 알라딘 Open API
ALADIN_TTB_KEY=your_ttb_key

# Discogs API
DISCOGS_TOKEN=your_token
# 또는
DISCOGS_CONSUMER_KEY=your_key
DISCOGS_CONSUMER_SECRET=your_secret
DISCOGS_USER_AGENT=your_user_agent
```

---

## 주요 문제점 요약

1. **API 호출 과다**
   - `sync-lp-data.ts`: 제품당 8개 API 동시 호출
   - `hourly-sync.ts`: 모든 작업을 한 번에 실행
   - Rate limit 위반으로 API 밴 발생

2. **데이터 품질 저하**
   - `isValidLpMatch`: 70% 매칭만 요구 → 부정확한 데이터 수집
   - `fetch-real-lp-data.ts`: 검색 결과만으로 저장 → 아티스트/제목 부정확
   - 필터링이 약함 → CD, 포스터 등이 통과

3. **중복 데이터**
   - URL 기반 중복 체크가 약함
   - 같은 제품이 여러 번 수집됨

---

## 개선 권장사항

1. **API 호출 최적화**
   - `Promise.all` 제거, 순차 호출로 변경
   - 딜레이 5초 이상 추가
   - 배치 크기 50개로 축소

2. **필터링 강화**
   - `isValidLpMatch`: 70% → 95% 매칭 기준 상향
   - LP 키워드 필수 확인
   - CD/디지털 명시적 차단

3. **데이터 검증 강화**
   - 수집 전 EAN/Discogs ID 필수 체크
   - 상세 API 호출로 정확한 정보 추출

---

## 파일 구조

```
scripts/
├── sync-lp-data.ts          # 메인 가격 동기화 (8개 판매처)
├── fetch-real-lp-data.ts    # Discogs LP 수집
├── discover-korean-lps.ts   # 알라딘 한국 LP 발굴
├── hourly-sync.ts             # 통합 스케줄러
├── cleanup.ts                # 데이터 정리
├── deduplicate-offers.ts     # 중복 제거
└── [기타 분석/디버깅 스크립트들]
```

---

**마지막 업데이트**: 2024년 (현재 시점)
