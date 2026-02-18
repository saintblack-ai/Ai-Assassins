-- AI Assassins Phase A schema
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  brief_json jsonb not null,
  location text,
  focus text,
  tone text,
  timestamp timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  plan text not null check (plan in ('free','premium','pro','elite','enterprise')),
  status text not null default 'active',
  updated_at timestamptz default now()
);

create index if not exists idx_briefs_user_ts on public.briefs (user_id, timestamp desc);
create index if not exists idx_briefs_ts on public.briefs (timestamp desc);
create index if not exists idx_subscriptions_user_updated on public.subscriptions (user_id, updated_at desc);
create index if not exists idx_subscriptions_status on public.subscriptions (status);

alter table public.users enable row level security;
alter table public.briefs enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert with check (auth.uid() = id);

drop policy if exists briefs_select_own on public.briefs;
create policy briefs_select_own on public.briefs
for select using (auth.uid()::text = user_id);

drop policy if exists briefs_insert_own on public.briefs;
create policy briefs_insert_own on public.briefs
for insert with check (auth.uid()::text = user_id);

drop policy if exists briefs_delete_own on public.briefs;
create policy briefs_delete_own on public.briefs
for delete using (auth.uid()::text = user_id);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
for select using (auth.uid() = user_id);
