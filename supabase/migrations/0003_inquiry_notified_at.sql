-- Lets the scheduled notifier pick up each inquiry exactly once.
-- The notifier selects rows where notified_at is null, emails them, then stamps
-- the column. Anonymous buyers never touch it (their INSERT omits the column),
-- and it is not exposed to them because they cannot read the table at all.
-- Applied: 2026-09-10

alter table public.inquiries
  add column if not exists notified_at timestamptz;

create index if not exists inquiries_notified_idx
  on public.inquiries (notified_at)
  where notified_at is null;
