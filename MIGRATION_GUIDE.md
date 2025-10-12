# Figma Make → Cursor 마이그레이션

Figma Make에서 개발한 React+TypeScript+Vite 프로젝트를 로컬 개발 환경으로 전환합니다.

## 기술 스택
- React 18.2 + TypeScript 5.2
- Vite 5.0 (빌드 도구)
- Tailwind CSS v4 (next)
- Motion 10.16 (Framer Motion)
- Supabase Edge Functions (백엔드, Deno)
- Spotify Web API
- shadcn/ui (40개 컴포넌트)

## 필수 작업

### 1. 파일 구조 정리
현재 `/App.tsx`와 `/src/App.tsx`가 둘 다 존재합니다.

**작업:**
1. `/App.tsx` 내용을 `/src/App.tsx`로 복사 (기존 내용 덮어쓰기)
2. import 경로 수정:
   ```tsx
   // Before
   import { VinylPlayer } from './components/VinylPlayer';
   
   // After  
   import { VinylPlayer } from '../components/VinylPlayer';
   ```
3. `/App.tsx` 파일 삭제

### 2. 환경변수 설정
`.env` 파일을 프로젝트 루트에 생성:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

`/utils/supabase/info.tsx` 파일 수정:
```typescript
export const projectId = import.meta.env.VITE_SUPABASE_URL
  ?.replace('https://', '')
  .replace('.supabase.co', '') || '';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
```

### 3. main.tsx 확인
`/src/main.tsx`가 다음과 같은지 확인:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '../styles/globals.css';  // 중요!

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### 4. Tailwind 설정 확인
`/tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",  // 필수!
  ],
  theme: { extend: {} },
  plugins: [],
}
```

### 5. vite.config.ts 확인
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true
  },
})
```

## 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

## 예상 에러 및 해결

### 1. Import 경로 에러
```
Cannot find module './components/VinylPlayer'
```
→ `/src/App.tsx`의 모든 import를 `../`로 시작하도록 수정

### 2. Motion 에러
```
Module not found: motion
```
→ `import { motion } from 'motion/react'` 사용 (정확한 경로)

### 3. Tailwind 미적용
→ `src/main.tsx`에서 `import '../styles/globals.css'` 확인

### 4. 환경변수 undefined
→ `.env` 파일이 루트에 있는지, `VITE_` 접두사 사용했는지 확인

## 파일 우선순위

핵심 수정 파일:
1. `/src/App.tsx` (import 경로)
2. `/.env` (새로 생성)
3. `/utils/supabase/info.tsx` (환경변수)
4. `/src/main.tsx` (CSS import)
5. `/tailwind.config.js` (content 경로)

그 외 파일들은 수정 불필요.

## 프로젝트 구조

```
vinyl-player/
├── src/
│   ├── App.tsx           ← Vite 진입점 (여기 사용)
│   └── main.tsx          ← React render
├── components/
│   └── VinylPlayer.tsx   ← 메인 컴포넌트 (2000+ 줄)
├── styles/globals.css    ← Tailwind
├── utils/supabase/
│   └── info.tsx          ← 환경변수 처리
├── .env                  ← 생성 필요
└── vite.config.ts
```

## 핵심 차이점

| Figma Make | Cursor (Vite) |
|------------|---------------|
| `/App.tsx` | `/src/App.tsx` |
| `./components` | `../components` |
| 하드코딩된 변수 | `.env` + `import.meta.env` |
| 가상 파일시스템 | 실제 파일시스템 |

---

위 작업들을 순서대로 실행해주세요.
각 단계 완료 후 `npm run dev`로 테스트하고,
에러가 발생하면 에러 메시지를 공유해주세요.

---

## ✅ 완료 확인

Cursor AI 작업 후 다음을 확인:

```bash
# 1. 파일 확인
ls src/App.tsx           # 존재
ls .env                  # 존재
ls App.tsx               # 없어야 함 (삭제됨)

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저
# http://localhost:3000 에서 앱 로드 확인
```

---

## ⚠️ 중요 사항

**UI 건드리지 말 것!**
- 모바일/데스크톱 레이아웃 수정 금지
- LP 크기, 위치, 애니메이션 수정 금지
- 스타일 관련 파일 수정 시 신중할 것

