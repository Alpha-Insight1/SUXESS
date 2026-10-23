-- =============================================
-- Run once in Supabase SQL Editor
-- User roles: admin (all campuses) or secretary (one campus)
-- =============================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'secretary' check (role in ('admin', 'secretary')),
  campus_id uuid references public.campuses(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Admin has campus_id = null; secretary must have a campus_id
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_campus on public.profiles(campus_id);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Allow authenticated users to read campuses (already have policy)

-- Helper: after creating a user in Authentication → Users,
-- insert their profile, e.g.:
--
-- insert into public.profiles (id, full_name, role, campus_id)
-- values (
--   '<user-uuid-from-auth>',
--   'Admin Name',
--   'admin',
--   null
-- );
--
-- For a Main campus secretary:
-- insert into public.profiles (id, full_name, role, campus_id)
-- values (
--   '<user-uuid>',
--   'Main Secretary',
--   'secretary',
--   (select id from public.campuses where short_name = 'Main' limit 1)
-- );
