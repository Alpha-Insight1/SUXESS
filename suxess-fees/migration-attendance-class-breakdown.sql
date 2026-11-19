-- =============================================
-- Per-class attendance breakdown (Main / Suxess School only)
-- Run after migration-daily-attendance-messages.sql
-- =============================================

alter table public.daily_attendance
  add column if not exists class_breakdown jsonb default null;

comment on column public.daily_attendance.class_breakdown is
  'JSON map of class_name -> present_count, used by Main campus (Suxess School). Tutorial centres keep present_count only.';

-- Example value:
-- { "JSS 1": 28, "JSS 2": 31, "SS 1": 22 }
