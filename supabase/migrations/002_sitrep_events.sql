create extension if not exists pgcrypto;

create table if not exists public.sitrep_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  source text not null,
  type text not null,
  app text not null,
  severity text not null,
  message text,
  tags jsonb default '{}'::jsonb,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_sitrep_events_ts on public.sitrep_events (ts desc);
create index if not exists idx_sitrep_events_type on public.sitrep_events (type);
create index if not exists idx_sitrep_events_app on public.sitrep_events (app);
create index if not exists idx_sitrep_events_severity on public.sitrep_events (severity);
