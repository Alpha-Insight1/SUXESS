-- Multiple teachers per private lesson
alter table public.private_lessons
  add column if not exists teachers jsonb default '[]'::jsonb;

-- teacher_name / teacher_amount remain as summary (first teacher / total)
comment on column public.private_lessons.teachers is
  'Array of {name, amount} for each teacher on the lesson';
