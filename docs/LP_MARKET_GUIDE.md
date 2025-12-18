# LP 마켓 가이드

이 문서는 LP 마켓의 전체 기능과 설정 방법을 설명합니다.

## 목차

1. [데이터 동기화](#데이터-동기화)
2. [가격 정보 수집](#가격-정보-수집)
3. [네이버 쇼핑 API 설정](#네이버-쇼핑-api-설정)
4. [실시간 업데이트](#실시간-업데이트)
5. [크롤링 상태](#크롤링-상태)

## 데이터 동기화

LP 마켓은 Supabase를 사용하여 제품 및 가격 정보를 저장하고, 하루에 한번씩 자동으로 동기화합니다.

### Supabase 스키마 생성

Supabase SQL Editor에서 `scripts/create-supabase-schema.sql` 파일의 내용을 실행하세요.

### 환경 변수 설정

`.env` 파일에 다음 변수를 추가하세요:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 동기화 방법

1. **자동 동기화**: 앱 시작 시 하루가 지났으면 자동으로 동기화
2. **수동 동기화**: 마켓 페이지에서 "지금 동기화" 버튼 클릭
3. **실시간 업데이트**: Supabase realtime subscription으로 가격 정보 변경 시 자동 업데이트

## 가격 정보 수집

각 쇼핑몰에서 LP 가격 정보를 수집하는 기능이 구현되어 있습니다.

### 구현된 쇼핑몰

#### 대형 온라인 서점 (mega-book)
- ✅ **알라딘** - 정상 작동
- ⚠️ **YES24** - HTML 구조 확인 필요
- ⚠️ **교보문고** - 검색 URL 수정 필요
- ⚠️ **인터파크** - 타임아웃 문제 해결 필요

#### 종합몰 (omni-mall)
- ✅ **네이버 스마트스토어** - API 사용 (권장) 또는 크롤링
- ❌ **쿠팡** - 봇 차단 (puppeteer 필요)
- ⚠️ **11번가** - 검색어 개선 필요

#### 전문 레코드샵 (indy-shop)
- ⚠️ **향뮤직** - 타임아웃 문제 해결 필요
- ⚠️ **김밥레코드** - 사이트 구조 확인 필요
- ⚠️ **마장뮤직앤픽쳐스** - 사이트 구조 확인 필요

### 실행 방법

```bash
# 가격 동기화
npm run sync-lp-prices

# 테스트
npm run test-price-crawling
```

## 네이버 쇼핑 API 설정

네이버 쇼핑 API를 사용하면 크롤링보다 안정적이고 효율적으로 가격 정보를 수집할 수 있습니다.

### 설정 방법

1. [네이버 개발자 센터](https://developers.naver.com/) 접속
2. 애플리케이션 등록
3. "네이버 쇼핑 API" 선택
4. Client ID와 Client Secret 발급

### 환경 변수 추가

`.env` 파일에 추가:

```env
NAVER_CLIENT_ID=your_client_id_here
NAVER_CLIENT_SECRET=your_client_secret_here
```

자세한 내용은 [네이버 쇼핑 API 설정 가이드](./NAVER_SHOPPING_API_SETUP.md)를 참조하세요.

## 실시간 업데이트

가격 정보가 업데이트되면 UI에 자동으로 반영됩니다.

### 작동 방식

1. Supabase realtime subscription으로 `lp_offers` 및 `lp_products` 테이블 변경 감지
2. 변경 감지 시 자동으로 데이터 동기화
3. UI 자동 새로고침

### 구현 위치

- `src/hooks/useLpDataSync.ts` - 실시간 업데이트 로직
- `src/pages/market/LpHome.tsx` - UI 컴포넌트

## 크롤링 상태

### 현재 작동 중
- ✅ 알라딘

### 개선 필요
- ⚠️ YES24, 교보문고, 인터파크, 11번가 - HTML 구조 확인 및 선택자 수정
- ⚠️ 향뮤직 - 타임아웃 문제 해결

### 봇 차단
- ❌ 네이버 스마트스토어 - API 사용 권장
- ❌ 쿠팡 - puppeteer 필요

자세한 내용은 [크롤링 문제 및 해결 방안](./CRAWLING_ISSUES.md)을 참조하세요.


