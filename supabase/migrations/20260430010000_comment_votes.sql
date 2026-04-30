-- =====================================================================
-- Comment voting (Reddit-style upvote/downvote)
-- =====================================================================

-- comment_votes
create table if not exists public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_votes_comment_idx on public.comment_votes (comment_id);
create index if not exists comment_votes_user_idx on public.comment_votes (user_id);

alter table public.comment_votes enable row level security;

drop policy if exists "comment_votes_select_all" on public.comment_votes;
create policy "comment_votes_select_all" on public.comment_votes
  for select using (true);

drop policy if exists "comment_votes_insert_own" on public.comment_votes;
create policy "comment_votes_insert_own" on public.comment_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "comment_votes_update_own" on public.comment_votes;
create policy "comment_votes_update_own" on public.comment_votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "comment_votes_delete_own" on public.comment_votes;
create policy "comment_votes_delete_own" on public.comment_votes
  for delete using (auth.uid() = user_id);

-- comments.score (denormalized sum of votes; 별도 컬럼으로 기존 likes와 공존)
alter table public.comments
  add column if not exists score int not null default 0;

create or replace function public.comment_votes_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.comments set score = score + new.value where id = new.comment_id;
    return new;
  elsif (tg_op = 'UPDATE') then
    if (new.value <> old.value) then
      update public.comments set score = score + (new.value - old.value) where id = new.comment_id;
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.comments set score = score - old.value where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_votes_recalc on public.comment_votes;
create trigger comment_votes_recalc
  after insert or update or delete on public.comment_votes
  for each row execute function public.comment_votes_after_change();
