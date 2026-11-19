-- =============================================
-- Daily Attendance + In-app Messaging (with voice notes)
-- Run in Supabase SQL Editor
-- =============================================

-- Daily attendance: secretary records how many students were present each day
create table if not exists public.daily_attendance (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid not null references public.campuses(id) on delete cascade,
  attendance_date date not null,
  present_count integer not null check (present_count >= 0),
  total_enrolled integer, -- optional snapshot of active students that day
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (campus_id, attendance_date)
);

create index if not exists idx_daily_attendance_date on public.daily_attendance(attendance_date desc);
create index if not exists idx_daily_attendance_campus on public.daily_attendance(campus_id, attendance_date desc);

alter table public.daily_attendance enable row level security;

-- Secretaries can manage attendance for their own campus; admins for all
drop policy if exists "Attendance select" on public.daily_attendance;
create policy "Attendance select" on public.daily_attendance
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.campus_id = daily_attendance.campus_id)
    )
  );

drop policy if exists "Attendance insert" on public.daily_attendance;
create policy "Attendance insert" on public.daily_attendance
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.campus_id = daily_attendance.campus_id)
    )
  );

drop policy if exists "Attendance update" on public.daily_attendance;
create policy "Attendance update" on public.daily_attendance
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.campus_id = daily_attendance.campus_id)
    )
  );

-- =============================================
-- Messaging / Chat between admin and secretaries
-- =============================================

create table if not exists public.chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  -- For 1:1 admin <-> secretary; campus optional context
  campus_id uuid references public.campuses(id),
  title text, -- e.g. "Arepo desk"
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
  body text, -- text content (nullable if pure voice)
  voice_url text, -- Supabase Storage path or public URL for voice note
  voice_duration_sec numeric(6,1),
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_conv on public.chat_messages(conversation_id, created_at);
create index if not exists idx_chat_participants_user on public.chat_participants(user_id);

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

-- Participants can see their conversations
drop policy if exists "Conv select" on public.chat_conversations;
create policy "Conv select" on public.chat_conversations
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_conversations.id and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Conv insert" on public.chat_conversations;
create policy "Conv insert" on public.chat_conversations
  for insert to authenticated
  with check (true);

drop policy if exists "Part select" on public.chat_participants;
create policy "Part select" on public.chat_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.chat_participants cp2
      where cp2.conversation_id = chat_participants.conversation_id
        and cp2.user_id = auth.uid()
    )
  );

drop policy if exists "Part insert" on public.chat_participants;
create policy "Part insert" on public.chat_participants
  for insert to authenticated
  with check (true);

drop policy if exists "Part update" on public.chat_participants;
create policy "Part update" on public.chat_participants
  for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "Msg select" on public.chat_messages;
create policy "Msg select" on public.chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_messages.conversation_id
        and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Msg insert" on public.chat_messages;
create policy "Msg insert" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Storage bucket for voice notes (run once; may need service role or dashboard)
-- insert into storage.buckets (id, name, public) values ('chat-voice', 'chat-voice', true)
-- on conflict do nothing;
-- Then add storage policies so authenticated users can upload/read.

comment on table public.daily_attendance is 'Daily student present counts per campus, entered by secretaries';
comment on table public.chat_messages is 'In-app messages between admin and secretaries; supports text + voice notes';
