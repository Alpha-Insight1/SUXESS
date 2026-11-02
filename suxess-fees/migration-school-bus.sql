-- School bus module (Alpha Insight)
create table if not exists public.school_buses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate_number text,
  driver_name text,
  driver_phone text,
  route_name text,
  capacity int default 0,
  bus_fee numeric(12,2) default 0,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.student_bus_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  bus_id uuid not null references public.school_buses(id) on delete cascade,
  pickup_point text,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  assigned_at date default current_date,
  notes text,
  created_at timestamptz default now(),
  unique (student_id, bus_id, status)
);

create index if not exists idx_bus_assignments_student
  on public.student_bus_assignments(student_id);
create index if not exists idx_bus_assignments_bus
  on public.student_bus_assignments(bus_id);

alter table public.school_buses enable row level security;
alter table public.student_bus_assignments enable row level security;

drop policy if exists "Authenticated full access school_buses" on public.school_buses;
create policy "Authenticated full access school_buses"
  on public.school_buses for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated full access student_bus" on public.student_bus_assignments;
create policy "Authenticated full access student_bus"
  on public.student_bus_assignments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
