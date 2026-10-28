-- Fix profiles RLS so every user can ALWAYS read their own row
-- Run once in Supabase SQL Editor

alter table public.profiles enable row level security;

-- Drop old policies that can recurse / block reads
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_all_admin" on public.profiles;
drop policy if exists "Authenticated full access profiles" on public.profiles;

-- Anyone logged in can read their own profile (required for login role)
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Users can update their own row (optional)
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can manage all profiles (no recursive subquery)
-- Uses JWT claim is hard; simple approach: authenticated can insert own only
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Service / table editor still works as postgres / service_role (bypasses RLS)

-- Ensure director row is admin (edit email if needed)
-- update public.profiles set role = 'admin', campus_id = null
-- where id = (select id from auth.users where email = 'director@example.com');
