-- Discogs master_id 블록리스트
-- 부틀렉/엉뚱한 데이터로 판별되어 재수집을 막을 master_id 모음
--
-- 사용처:
--   - scripts/fetch-beatles.ts (스크래퍼): 이 테이블의 master_id는 새로 안 긁음
--   - scripts/keep-*-official.ts (정리 스크립트): 삭제하면서 master_id를 여기에 적재

create table if not exists public.lp_master_blocklist (
  master_id      text primary key,
  artist         text,
  reason         text,
  blocked_title  text,
  discogs_id     text,
  created_at     timestamptz not null default now()
);

create index if not exists lp_master_blocklist_artist_idx
  on public.lp_master_blocklist (artist);

-- 서비스 롤 외에는 접근 불필요 — RLS 켜고 정책은 비워둠
alter table public.lp_master_blocklist enable row level security;

comment on table  public.lp_master_blocklist is 'Discogs master_id 블록리스트: 부틀렉/잘못된 데이터로 분류되어 재수집 차단';
comment on column public.lp_master_blocklist.master_id     is 'Discogs master_id (release_id 아님)';
comment on column public.lp_master_blocklist.reason        is 'bootleg / wrong-artist / duplicate / manual 등';
comment on column public.lp_master_blocklist.blocked_title is '차단 시점의 release title (참고용)';
comment on column public.lp_master_blocklist.discogs_id    is '차단 시점의 release id (참고용)';
