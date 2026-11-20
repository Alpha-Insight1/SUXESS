-- =============================================
-- Secretary activity (online / last seen)
-- Run once in Supabase SQL Editor
-- =============================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists idx_profiles_last_seen on public.profiles(last_seen_at desc);

-- Each signed-in user can only "touch" their own row.
-- SECURITY DEFINER so secretaries do not need UPDATE rights on profiles.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid();
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- Directory read (needed so the director can see every secretary, and chat can show names).
-- Safe to re-run.
drop policy if exists "Authenticated can read profiles for directory" on public.profiles;
create policy "Authenticated can read profiles for directory"
  on public.profiles
  for select
  to authenticated
  using (true);
