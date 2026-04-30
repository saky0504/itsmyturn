# TODO — Auth / Ratings / Profile 후속 작업

> 1차 작업 완료 시점: 2026-04-30
> 1차 PR 범위: Google OAuth 로그인, /profile 페이지, LP 별점(1-10) + LP 모양 슬라이더, Reputation/Achievements, Admin 별점·회원 관리, 댓글 진입 버튼 제거.

---

## 🚀 배포 전 체크리스트 (필수)

- [ ] Supabase 대시보드 → SQL Editor 에서 `supabase/migrations/20260430000000_auth_and_ratings.sql` 실행
- [ ] Supabase → Authentication → Providers → **Google** 활성화 + Client ID/Secret 입력
- [ ] Supabase → Authentication → URL Configuration 에 추가
  - Site URL: `https://itsmyturn.app`
  - Redirect URLs: `https://itsmyturn.app/**`, `http://localhost:7777/**`
- [ ] Google Cloud Console → 클라이언트 → **승인된 JavaScript 출처**
  - `https://itsmyturn.app`
  - `http://localhost:7777`
- [ ] Google Cloud Console → 클라이언트 → **승인된 리디렉션 URI**
  - `https://nbizzgetxskphtltxnva.supabase.co/auth/v1/callback`
- [ ] OAuth 동의 화면 **테스트 → 프로덕션 게시** (외부 사용자도 로그인 가능)
- [ ] (모바일 빌드 시) Capacitor용 deep-link 추가 작업 필요 — 후속 항목 #1 참조

---

## 🧪 동작 확인 시나리오

### 웹 (`npm run dev` 후 `http://localhost:7777`)
- [ ] `/market` 헤더 우측 "로그인" 버튼 노출
- [ ] 로그인 → Google 동의 → `/auth/callback` 통과 → 원래 페이지로 복귀
- [ ] 로그인 후 아바타 드롭다운에서 Profile/Logout 동작
- [ ] `/profile` 진입 시 첫 방문에 Reputation +1 (24h 로그인 보너스)
- [ ] Achievement Gallery에 5개 업적 표시 (잠금 상태)
- [ ] LP 상세 페이지: 디스크 드래그 → 색 변화 (빨강→초록) → 손 떼면 저장
- [ ] 별점 입력 → 평판 +1, "first-rating" 업적 unlock
- [ ] 별점 10개 누적 → "rater-10" 업적 unlock
- [ ] 본인 별점 취소 (휴지통 아이콘) 동작
- [ ] 비로그인 상태에서는 평균만 보이고 "Google로 로그인" 버튼 표시
- [ ] 댓글 작성 → `comments.user_id` 채워짐 + 평판 +3 + "first-comment" 업적
- [ ] 평판 100/500 도달 시 해당 업적 자동 unlock
- [ ] Index(LP 플레이어) 화면에서 댓글 버튼이 사라졌는지 확인 (ShoppingBag만 남음)

### Admin (`/admin.html` 또는 `/admin`)
- [ ] "별점 관리" 탭: 별점 리스트, 검색, 단일 삭제
- [ ] "회원 관리" 탭: 회원 리스트 + Reputation ±10 / Protected 토글 / 회원 삭제

---

## 📌 후속 작업 (우선순위 표기)

### 🟥 높음
- [ ] **#8 OAuth 동의 화면 프로덕션 게시** — 테스트 사용자만 로그인 가능한 상태에서 일반 사용자도 가능하도록 승격
- [ ] **CAPTCHA / Rate-limit** — Supabase Auth → Settings → Bot Protection 활성화 (스팸 가입 방지)

### 🟧 중간
- [ ] **#1 Capacitor OAuth 통합** — `@capacitor/browser` + custom URL scheme deep-link
  - iOS: `Info.plist` URL Scheme 추가
  - Android: `AndroidManifest.xml` intent-filter 추가
  - `redirectTo`를 native 앱에서는 `itsmyturn://auth/callback` 으로 분기
- [ ] **#2 `/profile` Settings 화면** — display_name / avatar 변경 폼
  - Supabase Storage 버킷 `avatars` 만들고 업로드 RLS 정책
- [ ] **#4 LpHome 평균 별점 정렬/필터** — `lp_products.avg_rating` 이미 denorm 되어있음 (마이그레이션 후 자동)
- [ ] **#6 어뷰징 방지** — rating 변경 cooldown (5분 내 재변경 제한 등)
  - DB 레벨 trigger 또는 RPC로 검사
- [ ] **#7 Comments 본인 삭제 권한** — `comments` 테이블에 RLS `delete using auth.uid() = user_id` 추가
  - UI에도 본인 댓글에만 삭제 버튼
- [ ] **#11 모바일 디스크 드래그 정밀도** — 320px 이하에서 점수 9-10 구분 어려움 가능성, 손가락 영역 최적화 또는 ± 버튼 보조
- [ ] **#12 Privacy Policy / Terms 업데이트** — Google 계정 데이터 사용 명시 (이름/이메일/프로필 사진)

### 🟨 낮음
- [ ] **#3 다른 사용자 프로필 보기** — `/u/:userId` 라우트, 댓글 작성자 이름 클릭 시 진입
- [ ] **#5 가격 비교 카드에 별점 미니 뱃지** — `LpProductDetail` 가격 테이블에 작은 평균 점수 표시
- [ ] **#9 익명 닉네임 vs 로그인 사용자명 충돌 처리** — 같은 이름 가드, 또는 `verified` 뱃지로 구분
- [ ] **#10 Reputation 게이미피케이션** — 레벨/티어, 주간 랭킹, 시즌
- [ ] **#13 업적 추가** — 첫 별점 / 10개 / 100개, 평판 마일스톤 외에 "10일 연속 로그인", "여러 장르 평가" 등
- [ ] **#14 별점 분포 그래프** — LP 상세에 1-10 히스토그램

---

## 📝 알아두면 좋은 메모

### DB
- `profiles`: `auth.users` insert 시 trigger로 자동 생성. `display_name`은 Google `name` 또는 이메일 prefix.
- `lp_ratings.score`: 1~10 정수 check 제약. (product_id, user_id) unique → 한 사용자당 LP 하나에 1개 별점.
- `lp_products.avg_rating`/`rating_count`: trigger로 자동 갱신. 클라이언트는 직접 join 안 해도 됨.
- `comments.user_id`: 로그인 시 채움, 비로그인은 NULL → 익명 댓글은 평판 미가산.
- `claim_login_bonus()`: 24h 1회만 +1 평판. 클라이언트 SIGNED_IN 이벤트에서 자동 호출됨.

### 보안
- 모든 신규 테이블 RLS 활성화됨.
- `lp_ratings`: SELECT 누구나, INSERT/UPDATE/DELETE 본인 row만.
- `profiles`: SELECT 누구나, UPDATE 본인만 (관리자 작업은 `/api/admin/db.ts`의 service-role 우회).
- `claim_login_bonus()` / `unlock_achievement()`: SECURITY DEFINER + search_path 고정.

### 검색엔진
- `/profile`, `/auth/*`: `robots.txt` Disallow + `vercel.json` X-Robots-Tag noindex 적용됨.
- 사이트맵에는 자동 미포함.

### Reputation 산식 (1차)
- 24h당 첫 로그인: +1
- 별점 1개당: +1 (취소 시 -1, 최소 0)
- 댓글 1개당: +3 (삭제 시 -3, 최소 0)
- 평판 100/500 도달 시 업적 자동 unlock

---

마지막 업데이트: 2026-04-30
