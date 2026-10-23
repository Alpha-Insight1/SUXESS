-- =============================================
-- Run this once in Supabase SQL Editor
-- Soft delete / restore for payments
-- =============================================

-- 1. Add deleted_at column
alter table public.payments
  add column if not exists deleted_at timestamptz default null;

create index if not exists idx_payments_deleted_at on public.payments(deleted_at);

-- 2. When a payment is soft-deleted, reverse the amount on student_fees
create or replace function reverse_student_fee_on_payment_void()
returns trigger as $$
begin
  -- Soft delete: deleted_at went from null to a timestamp
  if old.deleted_at is null and new.deleted_at is not null and new.student_fee_id is not null then
    update public.student_fees
    set
      amount_paid = greatest(0, amount_paid - new.amount),
      status = case
        when greatest(0, amount_paid - new.amount) >= amount then 'paid'
        when greatest(0, amount_paid - new.amount) > 0 then 'partial'
        else 'pending'
      end,
      updated_at = now()
    where id = new.student_fee_id;
  end if;

  -- Restore: deleted_at went from a timestamp back to null
  if old.deleted_at is not null and new.deleted_at is null and new.student_fee_id is not null then
    update public.student_fees
    set
      amount_paid = amount_paid + new.amount,
      status = case
        when (amount_paid + new.amount) >= amount then 'paid'
        when (amount_paid + new.amount) > 0 then 'partial'
        else 'pending'
      end,
      updated_at = now()
    where id = new.student_fee_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_payment_void_or_restore on public.payments;
create trigger on_payment_void_or_restore
  after update of deleted_at on public.payments
  for each row execute function reverse_student_fee_on_payment_void();
