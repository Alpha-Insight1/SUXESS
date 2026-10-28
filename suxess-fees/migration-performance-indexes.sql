-- Run once in Supabase SQL Editor to speed up common queries
create index if not exists idx_students_full_name on public.students (full_name);
create index if not exists idx_students_admission on public.students (admission_number);
create index if not exists idx_students_parent_phone on public.students (parent_phone);
create index if not exists idx_students_status_campus on public.students (status, campus_id);
create index if not exists idx_profiles_id on public.profiles (id);
