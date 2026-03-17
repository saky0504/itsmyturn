# It's My Turn - AI Agent & Developer Guidelines

> [!IMPORTANT]
> This document serves as a comprehensive guide for AI agents and developers working on the "It's My Turn" project. It outlines the project's architecture, data pipelines, and specific quirks / domain knowledge that must be considered before making code changes.

## 1. Project Overview & Purpose

**It's My Turn** is a premium vinyl turntable music player application that also integrates an LP store/market feature.
The project is built as a cross-platform application targeting Web, iOS, and Android using the Capacitor framework.

**Core Offerings:**
- A customizable LP turntable UI with an embedded music player (fetching public domain music from the Internet Archive).
- An LP market/store tracking system discovering and displaying real-time prices for Korean and international LPs from various sources (e.g., Aladin, Discogs, and scraped store data).
- An Admin App for managing the LP database, running cron jobs, and manually triggering price syncs.

## 2. Tech Stack & Architecture

### Frontend Application (Web & Mobile Hybrid)
- **Framework:** React 18, Vite 5, TypeScript 5.2.
- **Styling:** Tailwind CSS v4, `shadcn/ui` components, `framer-motion`/`motion` for animations.
- **Mobile runtime:** Capacitor 7 (`@capacitor/core`, `/android`, `/ios`) and various native plugins (Push Notifications, Haptics, Browser, Share, In-App Review).
- **Core routes:** 
  - Standard App: `src/App.tsx`, `src/main.tsx`
  - Admin App: `src/AdminApp.tsx`, `src/admin.tsx`
  - Market/Store pages: `src/pages/market/*`

### Backend & Database
- **Primary DB & Auth:** Supabase (PostgreSQL, Row Level Security, Storage, Auth).
- **Serverless API:** Vercel Serverless Functions (`/api/*`). The application relies on Vercel endpoints to expose admin capabilities, hourly syncs, and price searches securely without leaking credentials to the client.
- **Data Fetching:** Scripts placed in `scripts/` are used to sync, discover, and fetch actual LP data from external APIs (like Aladin/Discogs) into Supabase.

> [!WARNING]
> **Secret Management**: Do **NOT** expose the `SUPABASE_SERVICE_ROLE_KEY` to the frontend using a `VITE_` prefix. A previous security vulnerability leaked this key via `VITE_SUPABASE_SERVICE_ROLE_KEY`. It must be kept strictly Backend/Serverless side (e.g., inside `.env.vercel` and accessed only sequentially by Vercel API or local scripts).

## 3. Directory Structure Guide

```text
itsmyturn/
├── api/                  # Vercel Serverless API routes (e.g., /api/search-prices.ts, /api/admin/*, /api/cron/*)
├── api-lib/              # Shared logic for serverless functions (e.g., db-ingest.ts, price-search.ts)
├── scripts/              # Node/TS scripts for data gathering (e.g. sync-lp-data.ts, discover-korean-lps.ts)
├── src/
│   ├── components/       # UI Components (VinylPlayer, CommunityBoard, shadcn/ui)
│   ├── data/             # Data logic (e.g. lpMarket.ts handling price calculations)
│   ├── lib/              # Utils and SDKs (supabase.ts, capacitor-plugins.ts, recommendation.ts)
│   ├── pages/            # Feature pages (e.g. market/LpHome.tsx)
│   ├── App.tsx & AdminApp.tsx
├── supabase/             # SQL schemas, security rules (RLS), Edge functions
├── android/ & ios/       # Capacitor native targets
```

## 4. Specific Domain Logistics & Known Quirks

When maintaining or extending this repository, keep the following context in mind:

### A. Crawling & Data Ingestion Standards (크롤링 및 데이터 수집 기준)

When writing, modifying, or running scripts to fetch LP data from external sources (Aladin, Discogs, etc.), strictly adhere to these rules:

1. **Deduplication (중복 앨범 처리 규칙)**
   - **Primary Key:** Use `discogs_id` as the safest primary key for deduplication whenever available.
   - **Aladin Data Issue:** Historically, Aladin-sourced albums often contained inaccurate `EAN` (barcodes), where `isbn13` was mistakenly forced as `EAN`. Do NOT attempt to display Aladin's `isbn13` as a standard barcode. The UI currently hides the EAN badge for Aladin-sourced items.
   - **Merge Safety:** Do not overwrite existing enriched data (like high-res images or verified tracklists) during daily/hourly syncs unless the new source data is explicitly proven to be superior.

2. **Image Resolution (이미지 해상도 규칙)**
   - **High-Resolution Priority:** Always extract and store the highest resolution image available.
   - **Aladin Specifics:** Always map the image to the `cover` field (high-res), and actively reject or ignore `coversum` (low-res thumbnail).
   - **Downgrade Prevention:** If a script updates an existing LP record, it must maintain the existing high-res cover. Never downgrade an image to a lower resolution during automated syncs.

3. **Rate Limiting & API Quotas (API 호출 속도 및 제한 관리)**
   - **Throttling:** Scripts like `sync-lp-data.ts` or `discover-korean-lps.ts` must include explicitly defined delays (e.g., `setTimeout` or `delay` utilities) to prevent database throttling and to respect external API rate limits (e.g., Discogs' limit of 60 req/min).
   - **Batch Processing:** Data scraping must be done in manageable batches rather than bulk-all-at-once memory-heavy operations.

### B. Shipping Fee Calculation
- **Price Engine:** Prices displayed in the store logic involve complex calculation logic specifically handled in `src/data/lpMarket.ts` -> `calculateOfferFinalPrice`.
- Ensure any changes involving `price` also consider the `shipping fee` application. A previous bug existed where shipping costs were not accurately factored into the user-displayed final price.

### C. Admin Operations
- Previously, frontend-based direct modifications of data caused 404s/UI inconsistencies since the admin user didn't have adequate bypassed RLS on the client. 
- All data modifications, deletions, and heavy syncs must pass through the **Vercel Serverless API** (`/api/admin/*`) acting with service-level privileges, rather than direct client-side Supabase REST mutations.

### D. Build & Environments
- **Environment variables**: Multiple files exist (`.env`, `.env.vercel`). Vercel sets its own variables upon deployment. Pay attention to `.env.vercel` for backend integrations.
- **Excel Parsing**: The project has logic to parse Excel files (likely for bulk uploading or syncing products). Be cautious that this logic iterates over *multiple sheets* and extracts specific dynamic categories, not just the first sheet.

## 5. Development Workflow

1. Start development server using `npm run dev` (this runs vite and local-api-server concurrently using `tsx`).
2. Do not use generic string replacements blindly.
3. Test Mobile changes by running `npm run build` followed by `npx cap sync`, then `npx cap open android` / `ios`.

## 6. AI Agent Guidelines

1. **Verify Context First**: Before modifying pricing data, always check `api-lib/` and `src/data/lpMarket.ts`.
2. **Never Expose Admin Keys**: Any new Supabase keys must be restricted to the backend `api/` endpoints.
3. **Use Absolute Paths**: In tool calls, always rely on absolute paths instead of relative directories to prevent path resolution errors.
4. **Data Sync**: Do not run data scraping scripts (`fetch-real-lp-data.ts`, `sync-lp-data.ts`) in an automated pipeline without explicitly checking their parameter boundaries to prevent database throttling or unexpected quota usage on Aladin/Discogs.

> [!TIP]
> Always check `package.json` scripts section for utility scripts that already exist. If you need to rebuild the market data schema, refer to `scripts/create-supabase-schema.sql`.
