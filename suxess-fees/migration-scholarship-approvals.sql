-- Allow pending scholarships awaiting director approval
alter table public.scholarships
  drop constraint if exists scholarships_status_check;

alter table public.scholarships
  add constraint scholarships_status_check
  check (status in ('active', 'ended', 'cancelled', 'pending_approval'));

alter table public.scholarships
  add column if not exists prior_fees_paid numeric(12,2) default 0;

alter table public.scholarships
  add column if not exists approved_at timestamptz;

alter table public.scholarships
  add column if not exists approved_by uuid references auth.users(id);

-- Director notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target_role text not null default 'admin',
  title text not null,
  body text,
  link text,
  related_scholarship_id uuid references public.scholarships(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_role on public.notifications(target_role, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Authenticated full access notifications" on public.notifications;
create policy "Authenticated full access notifications"
  on public.notifications for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
