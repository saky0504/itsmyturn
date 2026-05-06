-- =====================================================================
-- PostgREST embed 활성화: user_id FK를 auth.users → profiles 로 변경
-- profiles.id 자체가 auth.users(id)를 cascade 참조하므로 삭제 의미 동일
-- =====================================================================

-- lp_ratings.user_id → profiles.id
alter table public.lp_ratings
  drop constraint if exists lp_ratings_user_id_fkey;
alter table public.lp_ratings
  add constraint lp_ratings_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- comment_votes.user_id → profiles.id
alter table public.comment_votes
  drop constraint if exists comment_votes_user_id_fkey;
alter table public.comment_votes
  add constraint comment_votes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- user_achievements.user_id → profiles.id
alter table public.user_achievements
  drop constraint if exists user_achievements_user_id_fkey;
alter table public.user_achievements
  add constraint user_achievements_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- PostgREST 스키마 캐시 즉시 갱신
notify pgrst, 'reload schema';
