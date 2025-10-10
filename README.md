# 🎵 Vinyl Player - Premium LP Turntable

> **프리미엄 LP 턴테이블 UI를 가진 인터랙티브 음악 플레이어**  
> **Beautiful vinyl turntable interface with Spotify integration**

![Vinyl Player](https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop&crop=center)

[![Live Demo](https://img.shields.io/badge/🎵_Live_Demo-It's_My_Turn-blue?style=for-the-badge)](https://itsmyturn.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Source_Code-black?style=for-the-badge&logo=github)](https://github.com/your-username/itsmyturn)
[![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

## ✨ 주요 기능

### 🎨 **프리미엄 LP 디자인**
- **5레이어 홈 패턴 시스템** - 현실적인 바이닐 질감
- **부드러운 회전 애니메이션** - 재생 시 LP 회전 효과
- **밝은 그라디언트 테마** - 세련된 밝은 색상 시스템
- **반응형 디자인** - 모바일/데스크톱 완벽 지원

### 🎵 **인터랙티브 음악 조작**
- **터치/클릭 재생/일시정지** - LP 중앙 클릭으로 조작
- **스와이프 트랙 변경** - 좌우 스와이프로 이전/다음
- **하드웨어 볼륨 연동** - 볼륨 조작 시 토스트 표시
- **균등 간격 버튼** - CSS Grid 기반 5개 버튼 배치

### 🔗 **Spotify API 완전 연동**
- **음악 검색** - 실시간 Spotify 트랙 검색
- **추천 시스템** - 개인화된 음악 추천
- **트랙 정보** - 앨범 커버, 아티스트, 제목 표시
- **하이브리드 모드** - 아름다운 UI + 실제 음악 스트리밍

### 🎯 **사용자 경험**
- **로딩 인디케이터** - 단일 회전 링 + 중앙 음표 펄스
- **무채색 토스트** - 강제 오버라이드된 깔끔한 알림
- **심플한 검색 UI** - 밑줄 스타일 검색 팝업
- **완벽한 모바일 최적화** - 터치 친화적 인터페이스

## 🚀 빠른 시작

### 📋 요구사항
- **Node.js** 18.0+ 
- **npm** 또는 **yarn**
- **Supabase 계정** (백엔드용)
- **Spotify Developer 계정** (음악 API용, 선택사항)

### ⚡ 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/itsmyturn.git
cd itsmyturn

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어서 Supabase 정보 입력

# 4. 개발 서버 시작
npm run dev
```

### 🔧 환경 변수 설정

`.env` 파일을 생성하고 다음 정보를 입력하세요:

```env
# Supabase 설정 (필수)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Spotify API 설정 (선택사항 - 데모 모드 가능)
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

## 🏗️ 프로젝트 구조

```
vinyl-player/
├── src/
│   ├── components/           # React 컴포넌트들
│   │   ├── VinylPlayer.tsx  # 메인 LP 플레이어
│   │   ├── ui/              # Shadcn/ui 컴포넌트들
│   │   └── figma/           # Figma 에셋 관련 컴포넌트
│   ├── styles/
│   │   └── globals.css      # Tailwind V4 + 커스텀 CSS
│   ├── utils/
│   │   └── supabase/        # Supabase 설정
│   └── supabase/
│       └── functions/       # Edge Functions (백엔드)
├── package.json
├── vite.config.ts
└── README.md
```

## 🎨 기술 스택

### **Frontend**
- **React 18** - 메인 프레임워크
- **TypeScript** - 타입 안전성
- **Vite** - 빌드 도구
- **Tailwind CSS V4** - 스타일링
- **Motion (Framer Motion)** - 애니메이션
- **Shadcn/ui** - UI 컴포넌트 라이브러리

### **Backend**
- **Supabase** - BaaS (Backend as a Service)
- **Supabase Edge Functions** - 서버리스 함수
- **Deno** - 서버 런타임
- **Hono** - 웹 프레임워크

### **API & Services**
- **Spotify Web API** - 음악 스트리밍
- **Spotify Web Playback SDK** - 웹 플레이어

## 🔧 개발 가이드

### 🎵 음악 재생 문제 해결

현재 브라우저 보안 정책으로 인한 음원 재생 제한이 있습니다:

**해결 방법:**
1. **HTTPS 환경에서 테스트** - 로컬은 `localhost` 사용
2. **사용자 인터랙션 후 재생** - 자동재생 방지 정책 준수
3. **Spotify Premium 계정** - 30초 미리듣기 제한 해제

### 🚀 배포 가이드

**Vercel 배포 (추천):**
```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 프로젝트 배포
vercel

# 3. 환경 변수 설정
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

**Netlify 배포:**
```bash
# 1. 빌드
npm run build

# 2. Netlify에 dist 폴더 업로드
# 또는 GitHub 연동 사용
```

## 🎯 사용법

### **기본 조작**
1. **재생/일시정지**: LP 중앙 클릭 또는 하단 재생 버튼
2. **트랙 변경**: LP에서 좌우 스와이프 또는 하단 이전/다음 버튼
3. **음악 검색**: 하단 검색 버튼으로 Spotify 트랙 검색
4. **추천 음악**: 하단 추천 버튼으로 개인화된 추천 받기

### **고급 기능**
- **볼륨 조절**: 하드웨어 볼륨 버튼 사용 (토스트로 표시)
- **좋아요**: 하트 버튼으로 트랙 즐겨찾기
- **반복 재생**: 반복 버튼으로 루프 모드
- **셔플**: 셔플 버튼으로 랜덤 재생

## 🤝 기여하기

1. **Fork** 이 저장소
2. **Feature 브랜치** 생성 (`git checkout -b feature/amazing-feature`)
3. **커밋** (`git commit -m 'Add amazing feature'`)
4. **Push** (`git push origin feature/amazing-feature`)
5. **Pull Request** 생성

## 📝 라이선스

이 프로젝트는 **MIT 라이선스** 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사인사

- **Figma Make** - 초기 프로토타입 개발 환경
- **Spotify** - 음악 API 제공
- **Supabase** - 백엔드 인프라
- **Unsplash** - 고품질 이미지 제공
- **Shadcn/ui** - 아름다운 UI 컴포넌트

---

## 🔗 관련 링크

- **[Live Demo](https://itsmyturn.vercel.app)** - 실제 동작 확인
- **[Figma Design](https://figma.com/your-design-link)** - 원본 디자인
- **[Spotify API 문서](https://developer.spotify.com/documentation/web-api/)** - API 참조
- **[Supabase 문서](https://supabase.com/docs)** - 백엔드 참조

---

**Made with ❤️ by Vinyl Player Team**

> 🎵 *"음악은 영혼의 언어입니다. 이 플레이어로 그 언어를 더 아름답게 경험하세요."*