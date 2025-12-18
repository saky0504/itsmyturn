# 네이버 쇼핑 API 문제 해결 가이드

## HTTP 401 에러 해결 방법

### 에러 메시지
```
HTTP 401: {"errorMessage":"Scope Status Invalid : Authentication failed. (인증에 실패했습니다.)","errorCode":"024"}
```

### 해결 단계

#### 1. 환경 변수 확인

`.env` 파일에 다음이 올바르게 설정되어 있는지 확인:

```env
NAVER_CLIENT_ID=your_client_id_here
NAVER_CLIENT_SECRET=your_client_secret_here
```

**주의사항:**
- 공백이 없어야 합니다
- 따옴표로 감싸지 마세요
- 앞뒤 공백이 없어야 합니다

**잘못된 예:**
```env
NAVER_CLIENT_ID="your_client_id"  # 따옴표 제거
NAVER_CLIENT_ID = your_client_id  # 공백 제거
```

**올바른 예:**
```env
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
```

#### 2. 네이버 개발자 센터 확인

1. [네이버 개발자 센터](https://developers.naver.com/) 접속
2. 내 애플리케이션 목록에서 해당 애플리케이션 선택
3. **API 설정** 탭 확인:
   - ✅ "네이버 쇼핑 API"가 **활성화**되어 있어야 합니다
   - ❌ 비활성화되어 있으면 **활성화** 버튼 클릭

#### 3. Client ID와 Secret 확인

1. 네이버 개발자 센터에서 **Client ID**와 **Client Secret** 확인
2. `.env` 파일의 값과 일치하는지 확인
3. 복사/붙여넣기 시 공백이나 특수문자가 추가되지 않았는지 확인

#### 4. 애플리케이션 상태 확인

- 애플리케이션이 **정상** 상태인지 확인
- 만료되거나 비활성화된 경우 재등록 필요

#### 5. API 권한 확인

- **비로그인 오픈 API 서비스 환경**: `WEB` 선택되어 있어야 함
- **서비스 URL**: 올바른 도메인 설정
  - 프로덕션: `https://itsmyturn.app` (또는 실제 도메인)
  - 로컬 개발: `http://localhost:3000` 또는 `http://127.0.0.1:3000` 추가
  - **참고**: 로컬에서 테스트하는 경우 로컬 URL도 서비스 URL에 추가해야 합니다

### 테스트 방법

```bash
# 환경 변수 확인
npm run test-price-crawling
```

성공 시 다음과 같은 메시지가 표시됩니다:
```
[네이버 쇼핑 API] ✅ 네이버 쇼핑: 58,000원
```

실패 시:
```
[네이버 쇼핑 API] HTTP 401: ...
[네이버 쇼핑 API] ❌ 인증 실패 - 다음을 확인해주세요:
```

### 추가 확인 사항

1. **API 할당량**: 일일 25,000건 제한 확인
2. **네트워크**: 방화벽이나 프록시 설정 확인
3. **타임아웃**: 네트워크 지연 시 타임아웃 발생 가능

### 여전히 작동하지 않는 경우

1. 네이버 개발자 센터 고객센터 문의
2. API 키 재발급 시도
3. 새로운 애플리케이션 등록


