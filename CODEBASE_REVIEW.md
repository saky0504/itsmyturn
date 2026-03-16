# Codebase Review Report

## Overview
The project is a Vite + React web/mobile application (using Capacitor for mobile builds) with a Vercel serverless backend. It serves as a premium LP (Vinyl) player and market aggregator, featuring integrations with Spotify, Internet Archive (for audio), and various Korean LP vendors (Naver, Aladin, Yes24, Kyobo, Gimbab).

## Architecture & Strengths
- **Tech Stack**: React 18, Vite, Tailwind CSS, Radix UI, Supabase, Vercel Serverless Functions.
- **Frontend Design**: Good use of modern React features (`Suspense`, `lazy` loading) in `App.tsx` for performance. UI is built with a solid component library (Radix + Tailwind). Custom hooks (`useNativeFeatures`, `useAudioPlayer`) are well-separated from the UI components.
- **Backend/API**: Integration with Supabase is solid, using Service Role keys for background functions.

## Areas for Improvement (Messy/Smell Code)

### 1. Monolithic API Handlers
**File:** `api/search-prices.ts` (830+ lines)
- **Issue**: This file is a classic monolith. It handles CORS preflight, Supabase client initialization, fetching from Naver API, and scraping HTML from Aladin, Yes24, Kyobo, and Gimbab using `cheerio`. It also implements caching and db upsert logic.
- **Recommendation**: Split this into a modular architecture.
  - `services/vendors/naver.ts`
  - `services/vendors/yes24.ts`
  - etc.
  - `utils/lp-matcher.ts` (for the complex `isValidLpMatch` logic and blacklists)

### 2. Hardcoded Blacklists and Rules
**File:** `api/search-prices.ts`
- **Issue**: The `isValidLpMatch` function contains hardcoded arrays (`blackListExact`, `blackListIncludes`, `allowedExtraTokens`).
- **Recommendation**: Move these lists to a separate configuration file or manage them via the Supabase database to allow updates without redeploying the code.

### 3. Error Handling and User Experience
**File:** `components/VinylPlayer.tsx`
- **Issue**: When audio tracks fail to load, the error boundary relies on `window.location.reload()`. This is a jarring experience in a Single Page Application (SPA).
- **Recommendation**: Implement a more graceful retry mechanism or targeted component reloading instead of refreshing the entire page.

### 4. Component Complexity
**File:** `src/pages/market/LpHome.tsx`
- **Issue**: The intersection observer logic for infinite scrolling (`sentinelRef`, `useEffect`) and `sessionStorage` manipulation is mixed inside the component.
- **Recommendation**: Extract the infinite scroll logic into a `useInfiniteScroll` custom hook, and the session storage logic into a `useSessionStorage` hook to keep the component UI-focused.

## Conclusion
The codebase is highly functional and leverages modern web technologies effectively. Addressing the monolithic API files and extracting hardcoded values/complex component logic into utilities/hooks will greatly improve maintainability and scalability.
