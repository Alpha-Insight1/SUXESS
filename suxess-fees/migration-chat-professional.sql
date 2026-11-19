-- =============================================
-- Professional messaging: RLS fixes + helpers
-- Run in Supabase SQL Editor after the base chat migration
-- =============================================

-- Allow every signed-in user to read basic profile info (needed for chat directory)
drop policy if exists "Authenticated can read profiles for directory" on public.profiles;
create policy "Authenticated can read profiles for directory"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Ensure chat tables exist (safe if already created)
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

create index if not exists idx_chat_messages_conv on public.chat_messages(conversation_id, created_at);
create index if not exists idx_chat_participants_user on public.chat_participants(user_id);
create index if not exists idx_chat_conversations_updated on public.chat_conversations(updated_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

-- Conversations: participants OR admin
drop policy if exists "Conv select" on public.chat_conversations;
create policy "Conv select" on public.chat_conversations
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_conversations.id and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin','director','owner','administrator'))
  );

drop policy if exists "Conv insert" on public.chat_conversations;
create policy "Conv insert" on public.chat_conversations
  for insert to authenticated
  with check (true);

drop policy if exists "Conv update" on public.chat_conversations;
create policy "Conv update" on public.chat_conversations
  for update to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_conversations.id and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin','director','owner','administrator'))
  );

-- Participants
drop policy if exists "Part select" on public.chat_participants;
create policy "Part select" on public.chat_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_participants cp2
      where cp2.conversation_id = chat_participants.conversation_id
        and cp2.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin','director','owner','administrator'))
  );

drop policy if exists "Part insert" on public.chat_participants;
create policy "Part insert" on public.chat_participants
  for insert to authenticated
  with check (true);

drop policy if exists "Part update" on public.chat_participants;
create policy "Part update" on public.chat_participants
  for update to authenticated
  using (user_id = auth.uid());

-- Messages
drop policy if exists "Msg select" on public.chat_messages;
create policy "Msg select" on public.chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_messages.conversation_id
        and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin','director','owner','administrator'))
  );

drop policy if exists "Msg insert" on public.chat_messages;
create policy "Msg insert" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
  );

-- Helpful: list who can be messaged
comment on table public.chat_conversations is '1:1 or small group chats between admin and secretaries';
