-- =============================================
-- CHAT FIX v2 — run this entire file in Supabase SQL Editor
-- Fixes: missing grants, RLS, uuid extension, directory access
-- =============================================

create extension if not exists "uuid-ossp";

-- Tables
create table if not exists public.chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid references public.campuses(id),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text,
  voice_url text,
  voice_duration_sec numeric(6,1),
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_conv on public.chat_messages(conversation_id, created_at desc);
create index if not exists idx_chat_participants_user on public.chat_participants(user_id);
create index if not exists idx_chat_conversations_updated on public.chat_conversations(updated_at desc);

-- Grants (critical — without these, PostgREST returns permission errors)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, update, delete on public.chat_participants to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select on public.profiles to authenticated;
grant select on public.campuses to authenticated;

-- Profiles: allow directory listing for chat
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "Authenticated can read profiles for directory" on public.profiles;
create policy "Authenticated can read profiles for directory"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role,'')) in ('admin','director','owner','administrator')
    )
  );

-- Chat RLS
alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Conv select" on public.chat_conversations;
drop policy if exists "Conv insert" on public.chat_conversations;
drop policy if exists "Conv update" on public.chat_conversations;
create policy "Conv select" on public.chat_conversations
  for select to authenticated using (true);
create policy "Conv insert" on public.chat_conversations
  for insert to authenticated with check (true);
create policy "Conv update" on public.chat_conversations
  for update to authenticated using (true);

drop policy if exists "Part select" on public.chat_participants;
drop policy if exists "Part insert" on public.chat_participants;
drop policy if exists "Part update" on public.chat_participants;
create policy "Part select" on public.chat_participants
  for select to authenticated using (true);
create policy "Part insert" on public.chat_participants
  for insert to authenticated with check (true);
create policy "Part update" on public.chat_participants
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "Msg select" on public.chat_messages;
drop policy if exists "Msg insert" on public.chat_messages;
create policy "Msg select" on public.chat_messages
  for select to authenticated using (true);
create policy "Msg insert" on public.chat_messages
  for insert to authenticated
  with check (sender_id = auth.uid());

-- Quick check: list staff profiles (should return rows for your secretaries)
-- select id, full_name, role, campus_id from public.profiles order by role, full_name;
