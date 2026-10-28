
alter table public.students
  add column if not exists address text;

alter table public.students
  add column if not exists department text;
