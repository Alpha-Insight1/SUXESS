-- Student address + exam board deadline + standard fee types
-- Run once in Supabase SQL Editor

alter table public.students
  add column if not exists address text;

alter table public.student_fees
  add column if not exists board_deadline date;

-- Ensure standard fee types exist
insert into public.fee_types (name, description)
select v.name, v.description
from (values
  ('WAEC', 'WAEC examination'),
  ('NECO', 'NECO examination'),
  ('GCE', 'GCE examination'),
  ('BECE', 'BECE examination'),
  ('Primary 6 Leaving Certificate', 'Primary 6 leaving certificate'),
  ('WAEC Result', 'WAEC result processing'),
  ('Testimonial', 'School testimonial'),
  ('School Fees', 'School fees'),
  ('Tuition (Monthly)', 'Monthly tutorial tuition'),
  ('JAMB', 'JAMB / UTME'),
  ('NECO GCE', 'NECO GCE'),
  ('WAEC GCE', 'WAEC GCE'),
  ('Uniform', 'School uniform')
) as v(name, description)
where not exists (
  select 1 from public.fee_types ft where lower(ft.name) = lower(v.name)
);
