-- Daily teacher payments (Arepo / Ofada tutorial centres)
-- Run once in Supabase SQL Editor

create table if not exists public.teacher_payments (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid references public.campuses(id) on delete cascade not null,
  teacher_name text not null,
  period_taught text not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text default 'cash' check (payment_method in ('cash', 'transfer', 'pos', 'other')),
  payment_date date not null default current_date,
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_teacher_payments_campus on public.teacher_payments (campus_id);
create index if not exists idx_teacher_payments_date on public.teacher_payments (payment_date);

alter table public.teacher_payments enable row level security;

drop policy if exists "Authenticated full access teacher_payments" on public.teacher_payments;
create policy "Authenticated full access teacher_payments" on public.teacher_payments
  for all using (auth.role() = 'authenticated');
