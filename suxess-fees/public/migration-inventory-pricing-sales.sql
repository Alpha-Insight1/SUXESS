-- Inventory cost/selling price + sales log
-- Run once in Supabase SQL Editor

alter table public.inventory_items
  add column if not exists cost_price numeric(12,2) not null default 0 check (cost_price >= 0);

alter table public.inventory_items
  add column if not exists selling_price numeric(12,2) not null default 0 check (selling_price >= 0);

create table if not exists public.inventory_sales (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  payment_method text default 'cash' check (payment_method in ('cash', 'transfer', 'pos', 'other')),
  student_id uuid references public.students(id) on delete set null,
  buyer_name text,
  campus_id uuid references public.campuses(id) on delete set null,
  notes text,
  sold_by uuid references auth.users(id),
  sale_date date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists idx_inventory_sales_date on public.inventory_sales (sale_date);
create index if not exists idx_inventory_sales_item on public.inventory_sales (inventory_item_id);

alter table public.inventory_sales enable row level security;

drop policy if exists "Authenticated full access inventory_sales" on public.inventory_sales;
create policy "Authenticated full access inventory_sales" on public.inventory_sales
  for all using (auth.role() = 'authenticated');
