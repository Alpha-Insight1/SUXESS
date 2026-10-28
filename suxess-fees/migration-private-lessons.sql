-- Private lessons (all campuses / admin + secretaries)
create table if not exists public.private_lessons (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid references public.campuses(id),
  parent_name text not null,
  parent_phone text,
  student_name text,
  amount_paid numeric(12,2) not null default 0,
  teacher_name text not null,
  teacher_amount numeric(12,2) not null default 0,
  lesson_date date not null default current_date,
  due_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_private_lessons_date on public.private_lessons(lesson_date);
create index if not exists idx_private_lessons_campus on public.private_lessons(campus_id);

alter table public.private_lessons enable row level security;

drop policy if exists "Authenticated full access private_lessons" on public.private_lessons;
create policy "Authenticated full access private_lessons"
  on public.private_lessons for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
