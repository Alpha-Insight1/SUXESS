-- Teacher / staff loans with monthly salary deduction
-- Run once in Supabase SQL Editor

create table if not exists public.staff_loans (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  principal numeric(12,2) not null check (principal > 0),
  monthly_deduction numeric(12,2) not null check (monthly_deduction > 0),
  amount_remaining numeric(12,2) not null check (amount_remaining >= 0),
  reason text default 'Loan',
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_staff_loans_staff on public.staff_loans(staff_id);
create index if not exists idx_staff_loans_status on public.staff_loans(status);

alter table public.staff_loans enable row level security;

drop policy if exists "Authenticated full access staff_loans" on public.staff_loans;
create policy "Authenticated full access staff_loans" on public.staff_loans
  for all using (auth.role() = 'authenticated');
