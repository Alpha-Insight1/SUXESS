
-- Ensure exam registration fee types exist (for Arepo / Ofada)
-- Run once in Supabase SQL Editor

insert into public.fee_types (name, description)
select v.name, v.description
from (values
  ('JAMB Registration', 'JAMB / UTME exam registration fee'),
  ('WAEC Registration', 'WAEC / SSCE exam registration fee'),
  ('NECO Registration', 'NECO exam registration fee'),
  ('GCE Registration', 'GCE exam registration fee'),
  ('SSCE Form', 'SSCE registration form fee'),
  ('Tuition (Monthly)', 'Tutorial centre monthly tuition')
) as v(name, description)
where not exists (
  select 1 from public.fee_types ft where lower(ft.name) = lower(v.name)
);
