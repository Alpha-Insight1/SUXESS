-- =============================================
-- SUXESS SCHOOLS - FEE MANAGEMENT SYSTEM
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- Enable UUID
create extension if not exists "uuid-ossp";

-- Campuses / Branches
create table public.campuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  short_name text,
  address text,
  phone text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Students
create table public.students (
  id uuid primary key default uuid_generate_v4(),
  admission_number text unique not null,
  full_name text not null,
  class_name text not null,
  campus_id uuid references public.campuses(id),
  parent_name text,
  parent_phone text,
  parent_email text,
  status text default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fee Types
create table public.fee_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

-- Student Fees (what is owed)
create table public.student_fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.students(id) on delete cascade not null,
  fee_type_id uuid references public.fee_types(id) not null,
  session text not null,
  term text not null,
  amount numeric(12,2) not null,
  amount_paid numeric(12,2) default 0,
  balance numeric(12,2) generated always as (amount - amount_paid) stored,
  due_date date,
  status text default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Payments
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.students(id) on delete cascade not null,
  student_fee_id uuid references public.student_fees(id),
  amount numeric(12,2) not null,
  payment_method text default 'cash' check (payment_method in ('cash', 'transfer', 'pos', 'cheque', 'other')),
  payment_date date default current_date,
  receipt_number text unique,
  notes text,
  recorded_by uuid references auth.users(id),
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_students_campus on public.students(campus_id);
create index idx_students_class on public.students(class_name);
create index idx_student_fees_student on public.student_fees(student_id);
create index idx_student_fees_status on public.student_fees(status);
create index idx_payments_student on public.payments(student_id);
create index idx_payments_date on public.payments(payment_date);
create index idx_payments_deleted_at on public.payments(deleted_at);

-- Auto update amount_paid when payment is recorded
create or replace function update_student_fee_paid()
returns trigger as $$
begin
  if new.student_fee_id is not null then
    update public.student_fees
    set 
      amount_paid = amount_paid + new.amount,
      status = case 
        when (amount_paid + new.amount) >= amount then 'paid'
        when (amount_paid + new.amount) > 0 then 'partial'
        else 'pending'
      end,
      updated_at = now()
    where id = new.student_fee_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_payment_insert
  after insert on public.payments
  for each row execute function update_student_fee_paid();

-- Auto generate receipt number: SUX-YYYYMMDD-00001
create sequence if not exists receipt_seq start 1;

create or replace function generate_receipt_number()
returns trigger as $$
begin
  if new.receipt_number is null then
    new.receipt_number := 'SUX-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('receipt_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_receipt_number
  before insert on public.payments
  for each row execute function generate_receipt_number();

-- Row Level Security
alter table public.campuses enable row level security;
alter table public.students enable row level security;
alter table public.fee_types enable row level security;
alter table public.student_fees enable row level security;
alter table public.payments enable row level security;

create policy "Authenticated full access campuses" on public.campuses for all using (auth.role() = 'authenticated');
create policy "Authenticated full access students" on public.students for all using (auth.role() = 'authenticated');
create policy "Authenticated full access fee_types" on public.fee_types for all using (auth.role() = 'authenticated');
create policy "Authenticated full access student_fees" on public.student_fees for all using (auth.role() = 'authenticated');
create policy "Authenticated full access payments" on public.payments for all using (auth.role() = 'authenticated');

-- Seed data: Campuses
insert into public.campuses (name, short_name) values
  ('Suxess Schools', 'Main'),
  ('Suxess Tutorial - Arepo', 'Arepo'),
  ('Suxess Tutorial - Ofada Mowe', 'Ofada Mowe');

-- Seed data: Fee Types
insert into public.fee_types (name, description) values
  ('Tuition', 'School tuition fees'),
  ('PTA Levy', 'Parent Teacher Association levy'),
  ('Development Levy', 'School development levy'),
  ('Examination Fee', 'Exam and assessment fees'),
  ('Uniform', 'School uniform'),
  ('Books & Materials', 'Textbooks and learning materials');

-- Soft delete / restore: reverse amount_paid when payment is voided or restored
create or replace function reverse_student_fee_on_payment_void()
returns trigger as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and new.student_fee_id is not null then
    update public.student_fees
    set
      amount_paid = greatest(0, amount_paid - new.amount),
      status = case
        when greatest(0, amount_paid - new.amount) >= amount then 'paid'
        when greatest(0, amount_paid - new.amount) > 0 then 'partial'
        else 'pending'
      end,
      updated_at = now()
    where id = new.student_fee_id;
  end if;

  if old.deleted_at is not null and new.deleted_at is null and new.student_fee_id is not null then
    update public.student_fees
    set
      amount_paid = amount_paid + new.amount,
      status = case
        when (amount_paid + new.amount) >= amount then 'paid'
        when (amount_paid + new.amount) > 0 then 'partial'
        else 'pending'
      end,
      updated_at = now()
    where id = new.student_fee_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger on_payment_void_or_restore
  after update of deleted_at on public.payments
  for each row execute function reverse_student_fee_on_payment_void();

-- =============================================
-- EXPENSES (daily expenses per campus)
-- =============================================
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

-- =============================================
-- STAFF (salaries per campus)
-- =============================================
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

-- RLS
alter table public.expenses enable row level security;
alter table public.staff enable row level security;

create policy "Authenticated full access expenses" on public.expenses for all using (auth.role() = 'authenticated');
create policy "Authenticated full access staff" on public.staff for all using (auth.role() = 'authenticated');

-- User profiles / RBAC
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'secretary' check (role in ('admin', 'secretary')),
  campus_id uuid references public.campuses(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_campus on public.profiles(campus_id);

alter table public.profiles enable row level security;

create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admins can manage profiles" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Exam preparing for (tutorial campuses)
alter table public.students add column if not exists exam_preparing_for text;

create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text default 'Textbook',
  quantity integer not null default 0 check (quantity >= 0),
  min_stock integer not null default 5 check (min_stock >= 0),
  unit text default 'pcs',
  campus_id uuid references public.campuses(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.inventory_items enable row level security;
create policy "Authenticated full access inventory" on public.inventory_items
  for all using (auth.role() = 'authenticated');
