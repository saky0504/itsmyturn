# 네이버 쇼핑 API 설정 가이드

## 개요

네이버 쇼핑 API를 사용하면 크롤링보다 안정적이고 효율적으로 가격 정보를 수집할 수 있습니다.

## 장점

1. ✅ **봇 차단 문제 해결** - 공식 API 사용으로 차단 없음
2. ✅ **안정적인 데이터** - 구조화된 JSON 응답
3. ✅ **빠른 응답** - 크롤링보다 훨씬 빠름
4. ✅ **공식 지원** - 네이버에서 공식 제공

## 설정 방법

### 1. 네이버 개발자 센터 가입

1. [네이버 개발자 센터](https://developers.naver.com/) 접속
2. 네이버 계정으로 로그인
3. "애플리케이션 등록" 클릭

### 2. 애플리케이션 등록

- **애플리케이션 이름**: `itsmyturn-lp-market` (또는 원하는 이름)
- **사용 API**: "네이버 쇼핑 API" 선택
- **서비스 URL**: 
  - 프로덕션: `https://itsmyturn.app` (또는 실제 도메인)
  - 로컬 개발: `http://localhost:3000` 또는 `http://127.0.0.1:3000`
  - **참고**: 여러 URL을 추가하려면 쉼표로 구분하거나 각각 별도로 추가
- **비로그인 오픈 API 서비스 환경**: `WEB` 선택

### 2-1. 로컬 개발 URL 추가 (선택사항)

로컬 개발 환경에서도 API를 사용하려면:

1. 네이버 개발자 센터 → 내 애플리케이션 → 해당 애플리케이션 선택
2. **API 설정** 탭 클릭
3. **서비스 URL** 필드에 다음 중 하나 추가:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - 또는 실제 사용하는 로컬 포트 번호
4. **저장** 버튼 클릭

**참고**: 
- 여러 URL을 추가하려면 각 URL을 새 줄에 입력하거나 쉼표로 구분
- 로컬 URL은 개발/테스트용이며, 프로덕션 배포 시에는 실제 도메인을 사용해야 합니다

### 3. 클라이언트 ID와 시크릿 키 발급

등록 완료 후:
- **Client ID** 발급
- **Client Secret** 발급

### 4. 환경 변수 설정

`.env` 파일에 추가:

```env
# 네이버 쇼핑 API
NAVER_CLIENT_ID=your_client_id_here
NAVER_CLIENT_SECRET=your_client_secret_here
```

## API 사용 방법

### 엔드포인트

```
GET https://openapi.naver.com/v1/search/shop.json
```

### 필수 파라미터

- `query`: 검색어 (예: "Radiohead In Rainbows LP")
- `display`: 검색 결과 출력 건수 (기본: 10, 최대: 100)
- `sort`: 정렬 옵션 (`sim`: 정확도순, `date`: 날짜순, `asc`: 가격 오름차순, `dsc`: 가격 내림차순)

### 헤더

```
X-Naver-Client-Id: {Client ID}
X-Naver-Client-Secret: {Client Secret}
```

### 응답 예시

```json
{
  "lastBuildDate": "Mon, 01 Jan 2024 12:00:00 +0900",
  "total": 100,
  "start": 1,
  "display": 10,
  "items": [
    {
      "title": "Radiohead - In Rainbows (LP)",
      "link": "https://shopping.naver.com/...",
      "image": "https://shopping-phinf.pstatic.net/...",
      "lprice": "58000",
      "hprice": "62000",
      "mallName": "네이버 스마트스토어",
      "productId": "12345678",
      "productType": "1",
      "brand": "Radiohead",
      "maker": "",
      "category1": "도서/음반",
      "category2": "음반",
      "category3": "LP",
      "category4": ""
    }
  ]
}
```

## 구현 예시

```typescript
async function fetchNaverShoppingAPI(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('[네이버 쇼핑 API] Client ID 또는 Secret이 설정되지 않았습니다.');
    return null;
  }

  // 검색어 구성
  let query = '';
  if (identifier.ean) {
    query = identifier.ean;
  } else if (identifier.title && identifier.artist) {
    query = `${identifier.artist} ${identifier.title} LP`;
  } else {
    return null;
  }

  const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=asc`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      console.log(`[네이버 쇼핑 API] HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[네이버 쇼핑 API] 검색 결과 없음: ${query}`);
      return null;
    }

    // 첫 번째 결과 사용 (가격 오름차순 정렬했으므로 최저가)
    const item = data.items[0];

    return {
      vendorName: item.mallName || '네이버 쇼핑',
      channelId: 'omni-mall',
      basePrice: parseInt(item.lprice) || parseInt(item.hprice),
      shippingFee: 0, // API에서 제공하지 않으므로 별도 확인 필요
      shippingPolicy: '배송비 별도',
      url: item.link,
      inStock: true,
    };
  } catch (error) {
    console.error('[네이버 쇼핑 API] Error:', error);
    return null;
  }
}
```

## API 제한 사항

### 일일 호출 제한
- **기본**: 25,000건/일
- **추가 신청 가능**: 필요 시 네이버에 문의

### 요청 제한
- 초당 요청 수 제한 있음 (과도한 요청 시 차단 가능)
- 적절한 딜레이 추가 권장

## 비용

- **무료**: 기본 할당량 내에서 무료 사용 가능
- **추가 할당량**: 필요 시 네이버에 문의

## 참고 자료

- [네이버 쇼핑 API 문서](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md)
- [네이버 개발자 센터](https://developers.naver.com/)
- [API 사용 가이드](https://developers.naver.com/docs/common/openapiguide/)

