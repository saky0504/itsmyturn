# 🎵 It's My Turn - Git 백업 가이드

## 🚀 **빠른 백업 방법**

### **1. 로컬에서 Git 초기화**

```bash
# 터미널에서 프로젝트 폴더로 이동
cd itsmyturn

# Git 저장소 초기화
git init

# 모든 파일 추가
git add .

# 첫 번째 커밋
git commit -m "🎵 Initial commit: It's My Turn - Premium LP Turntable Player

✨ Features:
- Premium 5-layer vinyl groove pattern system
- Interactive LP turntable with touch/swipe controls  
- Spotify API integration for real music streaming
- Beautiful gradient UI with realistic LP animations
- Mobile-optimized responsive design
- Hardware volume key support with toast notifications
- Hybrid mode: Beautiful UI + real music playback

🔧 Tech Stack:
- React 18 + TypeScript + Vite
- Tailwind CSS V4 + Motion (Framer Motion)
- Supabase backend + Edge Functions
- Shadcn/ui components + Lucide icons
- Spotify Web API integration"
```

### **2. GitHub에 업로드**

#### **방법 1: GitHub CLI (추천)**
```bash
# GitHub CLI 설치 후
gh repo create itsmyturn --public
git remote add origin https://github.com/your-username/itsmyturn.git
git branch -M main
git push -u origin main
```

#### **방법 2: 웹에서 생성**
1. **GitHub.com에서 새 저장소 생성**
   - Repository name: `vinyl-player`
   - Description: `🎵 Premium LP Turntable Music Player with Spotify Integration`
   - Public ✅
   - Add README ❌ (이미 있음)

2. **원격 저장소 연결**
```bash
git remote add origin https://github.com/your-username/vinyl-player.git
git branch -M main
git push -u origin main
```

### **3. 환경변수 설정**

#### **GitHub Repository Secrets (배포용)**
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase Anonymous Key
- `VITE_SPOTIFY_CLIENT_ID`: Spotify Client ID (선택)
- `VITE_SPOTIFY_CLIENT_SECRET`: Spotify Client Secret (선택)

#### **로컬 개발용 (.env)**
```bash
# .env.example을 복사해서 .env 파일 생성
cp .env.example .env

# .env 파일 편집
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 🔄 **Cursor/VSCode에서 프로젝트 시작**

### **1. 저장소 클론**
```bash
git clone https://github.com/your-username/vinyl-player.git
cd vinyl-player
```

### **2. 의존성 설치**
```bash
npm install
```

### **3. 환경변수 설정**
```bash
# .env 파일 생성 및 설정
cp .env.example .env
# 에디터에서 .env 파일을 열어 실제 값으로 변경
```

### **4. 개발 서버 시작**
```bash
npm run dev
```

### **5. 빌드 및 배포**
```bash
# 프로덕션 빌드
npm run build

# 로컬에서 프리뷰
npm run preview
```

---

## 🌐 **배포 옵션**

### **1. Vercel (추천)**
```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 배포
vercel

# 환경변수 추가
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

### **2. Netlify**
1. **netlify.com에서 GitHub 저장소 연결**
2. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **환경변수 추가** (Site settings → Environment variables)

### **3. GitHub Pages (정적 호스팅)**
```bash
# gh-pages 브랜치로 배포
npm install --save-dev gh-pages

# package.json에 추가:
# "homepage": "https://your-username.github.io/vinyl-player",
# "predeploy": "npm run build",
# "deploy": "gh-pages -d dist"

# 배포
npm run deploy
```

---

## 🛠️ **개발 워크플로우**

### **일반적인 Git 작업**
```bash
# 새 기능 브랜치 생성
git checkout -b feature/new-feature

# 변경사항 커밋
git add .
git commit -m "✨ Add new feature"

# 메인 브랜치에 병합
git checkout main
git merge feature/new-feature

# GitHub에 푸시
git push origin main
```

### **협업용 브랜치 전략**
```bash
# 기능별 브랜치
feature/spotify-integration
feature/mobile-optimization
feature/volume-controls

# 버그 수정
fix/audio-playback-issue
fix/mobile-touch-events

# UI 개선
ui/improve-loading-states
ui/enhance-animations
```

---

## 📋 **체크리스트**

### **백업 전 확인사항**
- ✅ 모든 중요 파일이 포함되었는지 확인
- ✅ .env 파일이 .gitignore에 포함되었는지 확인
- ✅ 민감한 정보가 코드에 하드코딩되지 않았는지 확인
- ✅ README.md가 최신 정보를 포함하는지 확인

### **배포 전 확인사항**
- ✅ 로컬에서 빌드가 성공하는지 확인 (`npm run build`)
- ✅ 환경변수가 올바르게 설정되었는지 확인
- ✅ 모든 기능이 정상 작동하는지 테스트
- ✅ 모바일에서도 정상 작동하는지 확인

---

**🎵 이제 완벽한 Vinyl Player 프로젝트가 안전하게 백업되고 배포 준비가 완료되었습니다!**