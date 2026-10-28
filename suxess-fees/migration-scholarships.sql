-- Scholarships granted by director
create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  campus_id uuid references public.campuses(id),
  session text not null default '2025/2026',
  term text not null default 'First Term',
  coverage text not null default 'full'
    check (coverage in ('full', 'partial')),
  amount_covered numeric(12,2) default 0,
  reason text,
  status text not null default 'active'
    check (status in ('active', 'ended', 'cancelled')),
  granted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_scholarships_student on public.scholarships(student_id);
create index if not exists idx_scholarships_session on public.scholarships(session, term);
create index if not exists idx_scholarships_status on public.scholarships(status);

alter table public.scholarships enable row level security;

drop policy if exists "Authenticated full access scholarships" on public.scholarships;
create policy "Authenticated full access scholarships"
  on public.scholarships for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
