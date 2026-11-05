-- Card / subscription validity for tutorial centres (Arepo, Ofada)
-- Run once in Supabase SQL Editor

alter table public.student_fees
  add column if not exists valid_until date;

create index if not exists idx_student_fees_valid_until
  on public.student_fees (valid_until);
