-- =====================================================================
-- Auth + Ratings + Achievements + Reputation
-- 2026-04-30
-- 안전 재실행: IF NOT EXISTS / IF EXISTS / OR REPLACE 위주
-- =====================================================================

-- ── 1. profiles ───────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  reputation int not null default 0,
  is_protected boolean not null default true,
  last_login_bonus_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_reputation_idx on public.profiles (reputation desc);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 새 auth.users 생성 시 자동으로 profiles row 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. lp_ratings ─────────────────────────────────────────────────────
create table if not exists public.lp_ratings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.lp_products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists lp_ratings_product_idx on public.lp_ratings (product_id);
create index if not exists lp_ratings_user_idx on public.lp_ratings (user_id);

alter table public.lp_ratings enable row level security;

drop policy if exists "lp_ratings_select_all" on public.lp_ratings;
create policy "lp_ratings_select_all" on public.lp_ratings
  for select using (true);

drop policy if exists "lp_ratings_insert_own" on public.lp_ratings;
create policy "lp_ratings_insert_own" on public.lp_ratings
  for insert with check (auth.uid() = user_id);

drop policy if exists "lp_ratings_update_own" on public.lp_ratings;
create policy "lp_ratings_update_own" on public.lp_ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lp_ratings_delete_own" on public.lp_ratings;
create policy "lp_ratings_delete_own" on public.lp_ratings
  for delete using (auth.uid() = user_id);

drop trigger if exists lp_ratings_set_updated_at on public.lp_ratings;
create trigger lp_ratings_set_updated_at
  before update on public.lp_ratings
  for each row execute function public.set_updated_at();

-- ── 3. lp_products: 별점 집계 컬럼 ────────────────────────────────────
alter table public.lp_products
  add column if not exists avg_rating numeric(3,1) not null default 0,
  add column if not exists rating_count int not null default 0;

create or replace function public.recalc_product_rating(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric(3,1);
  v_count int;
begin
  select coalesce(avg(score)::numeric(3,1), 0), count(*)
    into v_avg, v_count
    from public.lp_ratings
    where product_id = p_product_id;

  update public.lp_products
    set avg_rating = v_avg,
        rating_count = v_count
    where id = p_product_id;
end;
$$;

create or replace function public.lp_ratings_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_product_rating(old.product_id);
    return old;
  else
    perform public.recalc_product_rating(new.product_id);
    -- product_id가 바뀌는 case는 거의 없지만 방어
    if (tg_op = 'UPDATE' and old.product_id <> new.product_id) then
      perform public.recalc_product_rating(old.product_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists lp_ratings_recalc on public.lp_ratings;
create trigger lp_ratings_recalc
  after insert or update or delete on public.lp_ratings
  for each row execute function public.lp_ratings_after_change();

-- ── 4. achievements + user_achievements ──────────────────────────────
create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text,
  icon_name text,
  rarity text not null default 'common' check (rarity in ('common','rare','legendary')),
  sort_order int not null default 0
);

alter table public.achievements enable row level security;

drop policy if exists "achievements_select_all" on public.achievements;
create policy "achievements_select_all" on public.achievements
  for select using (true);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id);

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_all" on public.user_achievements;
create policy "user_achievements_select_all" on public.user_achievements
  for select using (true);

-- 시드: 기본 업적 5개
insert into public.achievements (id, title, description, icon_name, rarity, sort_order) values
  ('first-rating', '첫 별점', '첫 LP 별점을 남겼습니다', 'Star', 'common', 1),
  ('rater-10',     '평론가', '별점 10개를 달성했습니다', 'Stars', 'common', 2),
  ('first-comment','첫 댓글', '로그인 상태로 첫 댓글을 남겼습니다', 'MessageSquare', 'common', 3),
  ('reputation-100','Reputation 100', '평판 100을 달성했습니다', 'Award', 'rare', 4),
  ('reputation-500','Reputation 500', '평판 500을 달성했습니다', 'Trophy', 'legendary', 5)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order;

create or replace function public.unlock_achievement(p_user_id uuid, p_achievement_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, p_achievement_id)
    on conflict do nothing;
end;
$$;

-- ── 5. comments: 로그인 사용자 매핑 + reputation ──────────────────────
alter table public.comments
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists comments_user_id_idx on public.comments (user_id);

create or replace function public.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.user_id is not null) then
    update public.profiles
      set reputation = reputation + 3
      where id = new.user_id;

    perform public.unlock_achievement(new.user_id, 'first-comment');
  end if;
  return new;
end;
$$;

drop trigger if exists comments_reputation on public.comments;
create trigger comments_reputation
  after insert on public.comments
  for each row execute function public.comments_after_insert();

create or replace function public.comments_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.user_id is not null) then
    update public.profiles
      set reputation = greatest(reputation - 3, 0)
      where id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists comments_reputation_delete on public.comments;
create trigger comments_reputation_delete
  after delete on public.comments
  for each row execute function public.comments_after_delete();

-- ── 6. lp_ratings → reputation + 업적 ────────────────────────────────
create or replace function public.lp_ratings_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.profiles
    set reputation = reputation + 1
    where id = new.user_id;

  perform public.unlock_achievement(new.user_id, 'first-rating');

  select count(*) into v_count
    from public.lp_ratings
    where user_id = new.user_id;

  if v_count >= 10 then
    perform public.unlock_achievement(new.user_id, 'rater-10');
  end if;

  return new;
end;
$$;

drop trigger if exists lp_ratings_reputation on public.lp_ratings;
create trigger lp_ratings_reputation
  after insert on public.lp_ratings
  for each row execute function public.lp_ratings_after_insert();

create or replace function public.lp_ratings_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set reputation = greatest(reputation - 1, 0)
    where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists lp_ratings_reputation_delete on public.lp_ratings;
create trigger lp_ratings_reputation_delete
  after delete on public.lp_ratings
  for each row execute function public.lp_ratings_after_delete();

-- ── 7. profiles.reputation 변경 시 평판 업적 체크 ─────────────────────
create or replace function public.profiles_reputation_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.reputation >= 100 and (old.reputation is null or old.reputation < 100)) then
    perform public.unlock_achievement(new.id, 'reputation-100');
  end if;

  if (new.reputation >= 500 and (old.reputation is null or old.reputation < 500)) then
    perform public.unlock_achievement(new.id, 'reputation-500');
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_reputation_milestones on public.profiles;
create trigger profiles_reputation_milestones
  after update of reputation on public.profiles
  for each row execute function public.profiles_reputation_check();

-- ── 8. claim_login_bonus RPC ─────────────────────────────────────────
create or replace function public.claim_login_bonus()
returns table (granted boolean, reputation int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_last timestamptz;
  v_rep int;
begin
  if v_user_id is null then
    return query select false, 0;
    return;
  end if;

  select last_login_bonus_at into v_last
    from public.profiles
    where id = v_user_id
    for update;

  if v_last is null or v_last < now() - interval '24 hours' then
    update public.profiles
      set reputation = reputation + 1,
          last_login_bonus_at = now()
      where id = v_user_id
      returning reputation into v_rep;

    return query select true, v_rep;
  else
    select reputation into v_rep
      from public.profiles
      where id = v_user_id;

    return query select false, v_rep;
  end if;
end;
$$;

revoke all on function public.claim_login_bonus() from public;
grant execute on function public.claim_login_bonus() to authenticated;
