-- AI Assassins Phase 2 schema
-- Run in Supabase SQL editor

create table if not exists public.users (
  id uuid primary key,
  email text,
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'premium', 'enterprise', 'pro', 'elite')),
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  brief_json jsonb not null,
  location text,
  focus text,
  tone text,
  timestamp timestamptz not null default now()
);

create index if not exists idx_briefs_user_ts on public.briefs (user_id, timestamp desc);
create index if not exists idx_subscriptions_user_updated on public.subscriptions (user_id, updated_at desc);

-- Recommended RLS defaults
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.briefs enable row level security;

-- Service role (Worker) bypasses RLS.
-- Optional user policies for client reads:
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'briefs_select_own'
  ) then
    create policy briefs_select_own on public.briefs
      for select using (auth.uid()::text = user_id);
  end if;
end $$;

