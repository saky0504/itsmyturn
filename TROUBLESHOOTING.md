# 🔧 음원 스트리밍 문제 해결 가이드

## 📊 문제 진단 방법

### 1️⃣ 브라우저 콘솔 확인
**F12** 또는 **Ctrl+Shift+I** → **Console** 탭

#### 확인할 로그들:

**✅ 정상 작동 시:**
```
🎵 Initializing music player...
🎵 Loading Internet Archive classical music (CORS-safe, verified)...
✅ Final selected tracks: [...]
✅ Added 5 Internet Archive classical tracks to playlist
✅ Music player initialized successfully!
🎵 First track loaded - Click Play to start
```

**❌ 문제 발생 시:**
```
❌ Failed to load tracks: [에러 메시지]
❌ CORS error
❌ Network error
❌ 404 Not Found
```

---

## 🚨 주요 문제 원인과 해결책

### 문제 #1: 음원이 로드되지 않음

**증상:**
- 화면에 "No tracks available" 표시
- LP 커버가 보이지 않음

**원인:**
- Supabase 서버 체크 실패
- Internet Archive URL 접근 불가

**해결:**
```bash
# 브라우저 콘솔에서 테스트
const audio = new Audio('https://ia600901.us.archive.org/17/items/PianoConcerto-N.21/MoonlightSonata.mp3');
audio.play();
```

---

### 문제 #2: Play 버튼을 눌러도 재생 안 됨

**증상:**
- Play 버튼이 Pause로 바뀌지 않음
- LP가 회전하지 않음
- 로딩 스피너만 계속 돔

**원인:**
1. **브라우저 자동재생 정책**
   - Chrome/Edge: 사용자 인터랙션 필요
   - Safari: 더 엄격한 정책
   
2. **CORS (Cross-Origin) 에러**
   - 외부 도메인 음원 차단

3. **네트워크 에러**
   - 방화벽, 프록시, VPN

**해결:**

#### A) 브라우저 설정 확인
```
Chrome: chrome://settings/content/sound
- "사이트에서 소리 재생 허용" 활성화

Firefox: about:config
- media.autoplay.default = 0
```

#### B) HTTPS 사용
```bash
# HTTP가 아닌 HTTPS로 접속
https://localhost:3000  (X)
http://localhost:3000   (O)
```

#### C) 브라우저 콘솔 에러 확인
```javascript
// F12 Console에서
Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
→ 광고 차단기 비활성화

Access to audio at '...' from origin '...' has been blocked by CORS policy
→ 음원 URL 문제 (개발자에게 보고)
```

---

### 문제 #3: 음원이 중간에 끊김

**원인:**
- 느린 인터넷 연결
- Internet Archive 서버 부하

**해결:**
- 다른 네트워크 시도
- 시간대를 바꿔서 접속
- 브라우저 캐시 삭제

---

## 🧪 테스트 방법

### 콘솔에서 직접 테스트:

```javascript
// 1. 오디오 엘리먼트 확인
const audio = document.querySelector('audio');
console.log('Audio element:', audio);

// 2. 현재 src 확인
console.log('Current src:', audio?.src);

// 3. 수동 재생 테스트
audio?.play()
  .then(() => console.log('✅ 재생 성공'))
  .catch(e => console.error('❌ 재생 실패:', e));

// 4. Network State 확인
console.log('Network State:', audio?.networkState);
// 0: NETWORK_EMPTY
// 1: NETWORK_IDLE
// 2: NETWORK_LOADING
// 3: NETWORK_NO_SOURCE

// 5. Ready State 확인
console.log('Ready State:', audio?.readyState);
// 0: HAVE_NOTHING
// 1: HAVE_METADATA
// 2: HAVE_CURRENT_DATA
// 3: HAVE_FUTURE_DATA
// 4: HAVE_ENOUGH_DATA
```

---

## 🔍 단계별 디버깅

### Step 1: 페이지 로드 확인
- [ ] LP 이미지가 보이는가?
- [ ] 트랙 제목이 표시되는가?
- [ ] Play 버튼이 있는가?

### Step 2: 네트워크 확인
**F12 → Network 탭**
- [ ] 음원 URL이 요청되는가?
- [ ] 상태 코드가 200인가?
- [ ] CORS 에러가 있는가?

### Step 3: 콘솔 로그 확인
**F12 → Console 탭**
- [ ] "Music player initialized" 보이는가?
- [ ] "First track loaded" 보이는가?
- [ ] 빨간 에러가 있는가?

### Step 4: 수동 재생 테스트
```javascript
// 콘솔에서 실행
document.querySelector('audio').play();
```

---

## 💡 빠른 해결 팁

### 1. 페이지 새로고침
```
Ctrl + Shift + R (캐시 무시 새로고침)
```

### 2. 시크릿 모드 테스트
```
Ctrl + Shift + N (Chrome)
광고 차단기, 확장 프로그램 영향 제거
```

### 3. 다른 브라우저 시도
```
Chrome → Firefox → Edge 순서로 테스트
```

### 4. 개발자 도구 로그 전체 복사
```
Console에서 우클릭 → Save as...
문제 보고 시 첨부
```

---

## 📞 문제 보고 시 포함할 정보

1. **브라우저 정보**
   - 종류 (Chrome, Firefox, Safari...)
   - 버전
   
2. **콘솔 로그**
   - F12 → Console 탭 스크린샷
   - 전체 로그 텍스트

3. **Network 탭**
   - F12 → Network → 실패한 요청 스크린샷

4. **증상 상세 설명**
   - 어떤 버튼을 눌렀을 때
   - 어떤 화면이 보이는지
   - 에러 메시지

5. **재현 방법**
   - 단계별로 정확히

---

## 🎯 알려진 제한사항

### Internet Archive 음원:
- ✅ 공개 도메인 클래식 음원
- ✅ CORS 허용됨
- ⚠️ 서버 부하 시 느릴 수 있음
- ⚠️ 일부 국가/네트워크에서 차단될 수 있음

### 브라우저 자동재생:
- ⚠️ 사용자 클릭 후에만 재생 가능
- ⚠️ 음소거 상태에서만 자동 재생 허용

---

**여전히 문제가 해결되지 않으면 GitHub Issues에 보고해주세요:**
https://github.com/saky0504/itsmyturn/issues

