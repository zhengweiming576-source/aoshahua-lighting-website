-- Adds a plain-text product breakdown to each inquiry.
--
-- The client writes it at submit time (e.g. "Modern Wall Sconce × 100; Brass &
-- Crystal Linear Chandelier × 150"). It exists so the notification email can
-- list the products without needing a second query — a row-level webhook only
-- carries the row it fired on, not the child rows in inquiry_items.
--
-- Applied: 2026-09-10

alter table public.inquiries
  add column if not exists summary_text text;
