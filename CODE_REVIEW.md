# 코드 검토 결과

## ✅ 잘 구현된 부분

1. **프론트엔드 훅 (`useOnDemandPriceSearch.ts`)**
   - 에러 처리 적절
   - 로딩 상태 관리 정상
   - 타입 정의 명확

2. **프론트엔드 사용 (`LpHome.tsx`, `LpProductDetail.tsx`)**
   - 제품 정보를 올바르게 전달 (productId, artist, title, ean, discogsId)
   - 검색 후 refetch로 UI 업데이트

3. **데이터 흐름**
   - 캐시 확인 → 실시간 검색 → DB 저장 흐름이 논리적

## ⚠️ 발견된 문제점

### 1. **CORS 헤더 누락 (중요)**
```typescript
// api/search-prices.ts
// CORS 헤더를 정의했지만 실제 응답에 포함하지 않음
return response.status(200).json({ ... }); // ❌ CORS 헤더 없음
```

**수정 필요**: 모든 응답에 CORS 헤더 추가

### 2. **환경 변수 설정 필요**
`scripts/sync-lp-data.ts`가 사용하는 환경 변수들이 Vercel에 설정되어 있어야 함:
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `ALADIN_TTB_KEY`

**확인 필요**: Vercel 대시보드에서 환경 변수 설정 확인

### 3. **타임아웃 제한**
Vercel Serverless Function 타임아웃:
- Hobby: 10초
- Pro: 60초

`collectPricesForProduct`는 여러 API를 순차 호출하므로 시간이 오래 걸릴 수 있음.

**대응**: 
- 타임아웃 에러 처리 추가
- 진행 상황 로깅

### 4. **EAN/Discogs ID 검증**
`collectPricesForProduct`는 EAN 또는 Discogs ID를 필수로 요구:
```typescript
if (!identifier.ean && !identifier.discogsId) {
  return []; // 빈 배열 반환
}
```

**현재 상황**: 
- `api/search-prices.ts`에서 productId로 DB에서 제품 정보를 가져오므로, DB에 EAN/Discogs ID가 있으면 문제없음
- 하지만 DB에 없으면 검색이 실패함

**개선 제안**: EAN/Discogs ID가 없어도 제목+아티스트로 검색 가능하도록 수정

### 5. **에러 로깅 부족**
현재 에러는 콘솔에만 출력되고, 클라이언트에 상세 정보가 전달되지 않음.

**개선 제안**: 더 자세한 에러 메시지 반환

## 🔧 수정 권장 사항

### 우선순위 높음
1. **CORS 헤더 추가** - 브라우저에서 CORS 에러 발생 가능
2. **환경 변수 확인** - API 호출 실패 원인
3. **에러 처리 개선** - 디버깅 어려움

### 우선순위 중간
4. **타임아웃 처리** - 긴 검색 시간 대응
5. **EAN/Discogs ID 없이도 검색 가능하도록 개선**

## 테스트 체크리스트

- [ ] Vercel 환경 변수 설정 확인
- [ ] 브라우저에서 `/api/search-prices` 직접 호출 테스트
- [ ] CORS 에러 발생 여부 확인
- [ ] 타임아웃 발생 시나리오 테스트
- [ ] EAN/Discogs ID 없는 제품 검색 테스트
