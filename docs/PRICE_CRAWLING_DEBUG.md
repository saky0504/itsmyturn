# 가격 크롤링 디버깅 가이드

## 가격 정보를 못 찾는 경우 확인 방법

### 1. 테스트 스크립트 실행

```bash
npm run test-price-crawling
```

이 스크립트는 특정 제품에 대해 가격 정보를 수집하는지 테스트합니다.

### 2. 실제 동기화 로그 확인

```bash
npm run sync-lp-prices
```

실행 시 다음과 같은 로그가 출력됩니다:
- 각 쇼핑몰별 검색 URL
- 가격 추출 성공/실패 메시지
- 찾은 가격 정보 개수

### 3. 가능한 원인

#### 가격 정보가 실제로 없는 경우
- 해당 LP가 쇼핑몰에 판매되지 않음
- 재고가 없어서 검색 결과에 나타나지 않음
- 검색어가 정확하지 않음 (EAN, 제품명, 아티스트명 불일치)

#### 크롤링이 실패하는 경우
- **HTML 구조 변경**: 쇼핑몰 사이트의 HTML 구조가 변경되어 선택자가 맞지 않음
- **JavaScript 렌더링**: 일부 쇼핑몰(쿠팡 등)은 JavaScript로 동적 렌더링을 하므로 cheerio로는 크롤링 불가
- **Rate Limiting**: 너무 많은 요청으로 인해 차단됨
- **접근 제한**: robots.txt나 IP 차단

### 4. 로그 해석

#### 성공적인 크롤링
```
[YES24] Found price: 59000원 for Paranoid
[가격 수집] ✅ YES24: 59,000원
✅ Updated 3 offers for product xxx
```

#### 크롤링 실패
```
[YES24] No products found for: Paranoid
[YES24] Search URL: https://www.yes24.com/Product/Search?...
[YES24] Could not extract price from: 
```

### 5. 문제 해결 방법

#### HTML 구조 확인
1. 브라우저에서 해당 쇼핑몰 검색 페이지 열기
2. 개발자 도구로 HTML 구조 확인
3. `scripts/sync-lp-data.ts`의 선택자 업데이트

#### 검색어 개선
- EAN이 정확한지 확인
- 제품명과 아티스트명이 정확한지 확인
- 검색 URL이 올바른지 확인

#### 크롤링 방식 변경
- JavaScript 렌더링이 필요한 경우 `puppeteer` 사용 고려
- API가 제공되는 경우 API 사용

### 6. 현재 상태 확인

Supabase에서 직접 확인:
```sql
-- 제품별 가격 정보 확인
SELECT 
  p.title,
  p.artist,
  COUNT(o.id) as offer_count,
  p.last_synced_at
FROM lp_products p
LEFT JOIN lp_offers o ON p.id = o.product_id
GROUP BY p.id, p.title, p.artist, p.last_synced_at
ORDER BY p.last_synced_at DESC;
```

### 7. 수동 테스트

특정 제품으로 테스트:
1. `scripts/test-price-crawling.ts` 파일 열기
2. `testProducts` 배열에 실제 제품 정보 입력
3. `npm run test-price-crawling` 실행

