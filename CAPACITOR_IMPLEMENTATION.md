# Capacitor Native Features Implementation

## ✅ 완료된 작업

### 1. 플러그인 설치
```bash
npm install @capacitor/push-notifications
npm install @capacitor/haptics
npm install @capacitor/app
npm install @capacitor/share
npm install @capacitor/preferences
npm install @capacitor-community/in-app-review --legacy-peer-deps
```

### 2. 구현된 기능

#### 📱 Push Notifications
- **파일**: `src/lib/capacitor-plugins.ts`
- **함수**: `initPushNotifications()`
- **적용 위치**: `VinylPlayer.tsx` - `useEffect` 초기화
- **권한**: Android `AndroidManifest.xml`, iOS `Info.plist` 설정 완료

#### 🎮 Haptic Feedback
- **파일**: `src/lib/capacitor-plugins.ts`
- **함수**: 
  - `hapticLight()` - 가벼운 터치
  - `hapticMedium()` - 재생/일시정지
  - `hapticHeavy()` - 트랙 변경
- **적용 위치**:
  - `handlePlayPause()` - Play/Pause 시 medium haptic
  - `handleNextTrack()` - 다음 트랙 시 heavy haptic
  - `handlePreviousTrack()` - 이전 트랙 시 heavy haptic

#### 🎵 Background Audio
- **Android**: `AndroidManifest.xml` - FOREGROUND_SERVICE_MEDIA_PLAYBACK 권한 추가
- **iOS**: `Info.plist` - UIBackgroundModes (audio) 추가
- **참고**: HTML5 Audio API는 기본적으로 백그라운드 재생 지원

#### ⭐ In-App Review
- **파일**: `src/lib/capacitor-plugins.ts`
- **함수**:
  - `shouldShowReviewPrompt()` - 일주일 주기 체크
  - `requestReview()` - 리뷰 요청
  - `markReviewCompleted()` - 리뷰 완료 표시
- **적용 위치**: `handleEnded()` - 트랙 종료 시 자동 호출
- **로직**: 
  - 첫 요청 후 7일 주기로 재요청
  - 리뷰 완료 시 더 이상 표시 안 함
  - `Preferences` API로 상태 저장

#### 🔗 Share Functionality
- **파일**: `src/lib/capacitor-plugins.ts`
- **함수**:
  - `shareTrack(title, artist)` - 현재 트랙 공유
  - `shareApp()` - 앱 공유
- **TODO**: VinylPlayer UI에 Share 버튼 추가 필요

### 3. 웹 OG 메타태그
- **파일**: `index.html`
- **완료사항**:
  - Open Graph 메타태그 추가 (og:title, og:description, og:image 등)
  - Twitter Card 메타태그 추가
  - 이미지 URL: `https://itsmyturn.app/og-image.png`
  - **TODO**: `og-image.png` 파일 생성 필요 (1200x630px)

## 🚀 다음 단계

### 필수 작업:
1. **OG Image 생성** - `public/og-image.png` (1200x630px)
2. **Share 버튼 UI 추가** - VinylPlayer에 공유 버튼 추가
3. **Firebase 설정** (Push Notifications용):
   - `google-services.json` (Android)
   - `GoogleService-Info.plist` (iOS)
4. **Capacitor Sync**: `npx cap sync`
5. **빌드 & 테스트**: Android/iOS 앱에서 테스트

### 선택 작업:
1. **Media Session API** - 네이티브 미디어 컨트롤 (잠금화면, 알림)
2. **Background Task** - 백그라운드 작업 최적화
3. **App Icon & Splash Screen** - 앱 아이콘 및 스플래시 화면 업데이트

## 📝 사용 방법

### 앱 빌드
```bash
# 웹 빌드
npm run build

# Capacitor 동기화
npx cap sync

# Android 실행
npx cap open android

# iOS 실행 (Mac only)
npx cap open ios
```

### 환경별 기능 체크
```typescript
import { isNativePlatform } from '../lib/capacitor-plugins';

if (isNativePlatform()) {
  // 네이티브 앱에서만 실행
  await hapticMedium();
} else {
  // 웹에서만 실행
  console.log('Running on web');
}
```

## 🔐 권한 설정

### Android (`AndroidManifest.xml`)
- ✅ `INTERNET` - 네트워크
- ✅ `POST_NOTIFICATIONS` - Push 알림
- ✅ `FOREGROUND_SERVICE` - 백그라운드 서비스
- ✅ `FOREGROUND_SERVICE_MEDIA_PLAYBACK` - 백그라운드 오디오
- ✅ `WAKE_LOCK` - 화면 꺼짐 방지
- ✅ `VIBRATE` - Haptic 피드백

### iOS (`Info.plist`)
- ✅ `UIBackgroundModes` - audio, fetch, remote-notification
- ✅ `NSMicrophoneUsageDescription` - (사용 안 함 명시)

## 📚 참고 문서
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Haptics](https://capacitorjs.com/docs/apis/haptics)
- [Share](https://capacitorjs.com/docs/apis/share)
- [In-App Review](https://github.com/capacitor-community/in-app-review)

