# CLAUDE.md — 작업 규칙

이 프로젝트(itsmyturn, LP 가격 비교 앱)에서 Claude가 따라야 할 규칙. 같은 삽질 두 번 하지 말 것.

---

## 🎵 Discogs 앨범 스크래핑 규칙

### 1. 중복 방지는 무조건 `master_id` 기준

- release_id로 dedup하면 **절대 안 됨**. 같은 앨범이라도 발매국가/연도/포맷마다 release_id가 다 달라서 동일 앨범 100개씩 들어옴.
- title 정규화도 **소용없음**. "Sgt. Pepper's" / "Sgt Peppers" / 일본어/한국어/스페인어 번역판 다 통과시킴.
- **정답: `master_id`** — Discogs가 모든 에디션을 묶어주는 단일 ID.

### 2. 긁기 전에 DB의 기존 master_id를 먼저 수집

```ts
// 해당 아티스트의 기존 master_id를 Set으로 모은 다음
// 신규 데이터의 master_id가 그 Set에 있으면 스킵
const existingMasters = new Set<string>(/* DB에서 가져옴 */);
const seenMasters = new Set<string>(/* 이번 실행에서 본 것 */);
```

### 3. 검색 결과의 master_id를 detail 호출 전에 체크

- Discogs 검색 결과에도 `master_id`가 포함됨.
- 이미 있는 master면 detail API 호출 자체를 생략 → API 콜 절약 + 속도.

---

## 🚫 부틀렉/엉뚱한 아티스트 처리

### 4. 인기 아티스트는 부틀렉 폭탄 — 화이트리스트로 거르기

| 아티스트 | 시작 | 정식 유지 | 비고 |
|---|---|---|---|
| Oasis | 128 | 12 | 부틀렉/Trio Oasis/한국 경음악 오아시스 정리 |
| Radiohead | 62 | 12 | 부틀렉 50개 삭제 |
| Nirvana | 139 | 9 | 125 삭제, 90 master 블록 |
| Pearl Jam | 120 | 21 | 97 삭제, 49 master 블록 |
| Queen | 41 | 41 | 깔끔 (Queen Latifah는 사전 차단) |
| Led Zeppelin | 9 | 9 | 깔끔 |
| Beatles / Pink Floyd | - | - | 부틀렉 정리 미완료 |

**규칙**:
- 정식 master_id 화이트리스트를 `scripts/keep-<artist>.ts`에 하드코딩.
- 공용 러너 `scripts/keep-official.ts`의 `runKeepOfficial()` 호출.
- `master_id`가 `null`(no-master)인 release는 거의 다 부틀렉/짝퉁 → 기본 삭제 (`noMasterPolicy: 'delete'`).
- 정리 시 **삭제 + `lp_master_blocklist` 적재** 동시 — `fetch-beatles.ts`가 다음 실행 때 자동 차단.

### 4-1. 블록리스트 시스템

테이블 `public.lp_master_blocklist` (`supabase/migrations/20260512000000_master_blocklist.sql`):

```
master_id (PK) | artist | reason | blocked_title | discogs_id | created_at
```

- `scripts/keep-official.ts` 의 `runKeepOfficial()` 이 삭제 시 자동 upsert.
- `scripts/fetch-beatles.ts` 가 시작할 때 모든 master_id 로드, 검색결과 + 상세 응답 양쪽에서 차단.
- 한번 부틀렉으로 분류된 master는 **영구적으로 재수집 불가**.

### 5. 검색 결과에 섞이는 다른 아티스트 차단

- "Queen" 검색 → Queen Latifah, McQueen Street.
- "Oasis" 검색 → Trio Oasis, Banda Oasis, 한국 경음악 오아시스.
- artist 필드가 **정확히 일치**하거나 `"target,"` / `"target "`로 시작하는 것만 유지. 그 외는 삭제 (`scripts/remove-wrong-artists.ts`).

---

## ⚙️ API & 환경 규칙

### 6. Discogs Rate limit

- 인증 토큰 사용 시 60 req/min → **호출 사이 1.2초 sleep**.
- 429 받으면 **30초 sleep** 후 재시도.
- "일일 제한 없음"은 거짓말 — 실제론 자주 429 맞음.
- **여러 아티스트 동시 실행 금지**. 순차로 돌릴 것.

### 7. dotenv 경로

```ts
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });
```

- `VITE_SUPABASE_SERVICE_ROLE_KEY`는 `.env.local`에만 있음.
- `dotenv.config()`만 쓰면 `.env`만 읽어서 Supabase 인증 실패함.

---

## 📋 표준 작업 순서

새 아티스트 긁을 때:

```
1. npx tsx scripts/fetch-beatles.ts "<아티스트>"
   → 기존 master 수집 후 신규 master만 추가

2. (부틀렉 의심되면) list-<artist>-masters.ts 작성·실행
   → DB 전체의 master_id 분포 확인

3. 정식 master_id 추려서 keep-<artist>-official.ts 작성
   → 화이트리스트 하드코딩

4. 실행 → 정식만 남고 나머지 삭제
```

---

## 🔧 재사용 가능한 스크립트

| 파일 | 용도 |
|---|---|
| `scripts/fetch-beatles.ts` | 아티스트 인자 받는 범용 스크래퍼 (master_id dedup + 블록리스트 차단) |
| `scripts/keep-official.ts` | 공용 정리 러너 (삭제+블록리스트 적재) |
| `scripts/keep-nirvana.ts` / `keep-pearljam.ts` / `keep-radiohead-official.ts` / `keep-official-only.ts` (Oasis) | 아티스트별 화이트리스트 |
| `scripts/list-masters.ts` | master_id 분포 조사 (`npx tsx scripts/list-masters.ts "아티스트"`) |
| `scripts/remove-wrong-artists.ts` | 엉뚱한 아티스트 제거 |
| `scripts/cleanup-by-master.ts` | master_id 기준 중복 정리 |

---

## ⛔ 절대 하지 말 것

- ❌ `dotenv.config()`만 쓰기 — 항상 `path: ['.env.local', '.env']`
- ❌ release_id나 title로 중복 체크 — 무조건 master_id
- ❌ "안 쓰는 것 같은 스크립트" 멋대로 삭제 — `hourly-sync.ts`가 import하는지 먼저 확인 (5/7 사고: cleanup.ts, discover-korean-lps.ts 삭제로 GitHub Actions 이틀간 죽음)
- ❌ 사용자에게 묻지 않은 정보 멋대로 떠들기 (Discogs 호출 가능 횟수 등)
- ❌ 여러 아티스트 동시에 긁기 — rate limit으로 다 죽음

---

## 🛠 인프라 메모

- **GitHub Actions** `hourly-sync` 워크플로우는 `scripts/hourly-sync.ts` 실행.
  - import 체인: `fetch-real-lp-data`, `sync-lp-data`, `cleanup`, `discover-korean-lps`.
  - 이 중 하나라도 없으면 워크플로우 즉사 (실행 시간 1분대로 폭락).
- **Vercel 자동배포**: 짧은 간격 push 시 이전 빌드 cancel됨. 마지막 push만 살아남음.
- **Sitemap**: `api/sitemap.ts`가 동적 생성. Google Search Console에 재제출 필요할 수 있음.
- **Supabase auth**: `persistSession: true`, `storageKey: 'imt-auth'` 설정 유지 (로그인 풀림 방지).

---

## 💬 커뮤니케이션 규칙

- 사용자가 묻지 않은 거 먼저 떠들지 말 것.
- 답할 때는 결과/원인부터, 군더더기 사과나 자기변명 금지.
- 파괴적 작업(DB 삭제, force push 등)은 실행 전 확인.
