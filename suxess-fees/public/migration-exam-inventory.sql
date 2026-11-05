-- =============================================
-- Exam field (Arepo/Ofada) + Inventory (Main)
-- Run once in Supabase SQL Editor
-- =============================================

-- Exam the student is preparing for (tutorial centres)
alter table public.students
  add column if not exists exam_preparing_for text;

-- Inventory items (textbooks, materials, etc.)
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

create index if not exists idx_inventory_name on public.inventory_items (name);
create index if not exists idx_inventory_qty on public.inventory_items (quantity);

alter table public.inventory_items enable row level security;

drop policy if exists "Authenticated full access inventory" on public.inventory_items;
create policy "Authenticated full access inventory" on public.inventory_items
  for all using (auth.role() = 'authenticated');
