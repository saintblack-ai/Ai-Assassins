-- Phase A hardening: secure-by-default RLS for public.briefs
-- Notes:
-- - briefs.user_id is currently text, so auth.uid() is cast to text.
-- - This preserves compatibility while enforcing owner-only access.

begin;

alter table if exists public.briefs enable row level security;
alter table if exists public.briefs force row level security;

-- Default deny: remove broad table grants first.
revoke all on table public.briefs from anon;
revoke all on table public.briefs from authenticated;

-- Allow only required operations for authenticated users; RLS still filters rows.
grant select, insert, delete on table public.briefs to authenticated;

drop policy if exists briefs_select_own on public.briefs;
create policy briefs_select_own
on public.briefs
for select
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists briefs_insert_own on public.briefs;
create policy briefs_insert_own
on public.briefs
for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists briefs_delete_own on public.briefs;
create policy briefs_delete_own
on public.briefs
for delete
to authenticated
using (user_id = auth.uid()::text);

commit;
