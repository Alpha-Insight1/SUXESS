-- =============================================
-- Run once in Supabase SQL Editor
-- Expenses + Staff for multi-campus tracking
-- =============================================

create extension if not exists "uuid-ossp";

create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid references public.campuses(id) on delete cascade not null,
  expense_date date default current_date not null,
  category text not null default 'general',
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text default 'cash' check (payment_method in ('cash', 'transfer', 'pos', 'cheque', 'other')),
  recorded_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_expenses_campus on public.expenses(campus_id);
create index if not exists idx_expenses_date on public.expenses(expense_date);

create table if not exists public.staff (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid references public.campuses(id) on delete cascade not null,
  full_name text not null,
  role text,
  phone text,
  salary numeric(12,2) not null default 0 check (salary >= 0),
  status text default 'active' check (status in ('active', 'inactive')),
  start_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_staff_campus on public.staff(campus_id);
create index if not exists idx_staff_status on public.staff(status);

alter table public.expenses enable row level security;
alter table public.staff enable row level security;

drop policy if exists "Authenticated full access expenses" on public.expenses;
create policy "Authenticated full access expenses" on public.expenses for all using (auth.role() = 'authenticated');

drop policy if exists "Authenticated full access staff" on public.staff;
create policy "Authenticated full access staff" on public.staff for all using (auth.role() = 'authenticated');
