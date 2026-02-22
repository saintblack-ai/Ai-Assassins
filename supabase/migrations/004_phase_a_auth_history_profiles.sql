begin;

create extension if not exists pgcrypto;

create table if not exists public.brief_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_brief_history_user_created
  on public.brief_history (user_id, created_at desc);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_active_subscriber boolean not null default false
);

alter table public.brief_history enable row level security;
alter table public.brief_history force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.brief_history from anon;
revoke all on table public.brief_history from authenticated;
grant select, insert on table public.brief_history to authenticated;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists brief_history_select_own on public.brief_history;
create policy brief_history_select_own
on public.brief_history
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists brief_history_insert_own on public.brief_history;
create policy brief_history_insert_own
on public.brief_history
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

commit;

