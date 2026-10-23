-- Track board registration after student has paid exam registration fee
-- (JAMB, WAEC/SSCE, NECO, etc.)
-- Run once in Supabase SQL Editor

alter table public.student_fees
  add column if not exists board_registered boolean not null default false;

alter table public.student_fees
  add column if not exists board_registered_at timestamptz;

create index if not exists idx_student_fees_board_registered
  on public.student_fees (board_registered);
