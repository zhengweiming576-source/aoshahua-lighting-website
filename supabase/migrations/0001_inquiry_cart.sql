-- AOSHAHUA Lighting — inquiry cart (RFQ) storage
-- Buyers submit an inquiry anonymously; only allow-listed staff can read it.
-- Applied: 2026-09-10

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- inquiries
create table if not exists public.inquiries (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique,                 -- e.g. AHA-20260910-8F3C
  company         text,
  contact_name    text not null,
  email           text not null,
  country         text,
  message         text,
  status          text not null default 'new' check (status in ('new', 'handled')),
  item_count      integer not null default 0,
  total_pieces    integer not null default 0,
  total_estimate  numeric(14,2),                        -- qty x price, only for priced lines
  currency        text not null default 'CNY',
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------ inquiry_items
create table if not exists public.inquiry_items (
  id            uuid primary key default gen_random_uuid(),
  inquiry_id    uuid not null references public.inquiries(id) on delete cascade,
  product_id    text,          -- the 1688 offer id used as the catalog key
  product_name  text not null,
  model         text,
  series        text,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(14,2), -- price snapshot; null when the item is quote-only
  currency      text not null default 'CNY',
  line_note     text
);

create index if not exists inquiries_created_at_idx   on public.inquiries (created_at desc);
create index if not exists inquiries_status_idx       on public.inquiries (status);
create index if not exists inquiry_items_inquiry_idx  on public.inquiry_items (inquiry_id);
create index if not exists inquiry_items_product_idx  on public.inquiry_items (product_id);

-- ------------------------------------------- server-side totals on a parent
create or replace function public.recalc_inquiry_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.inquiry_id, old.inquiry_id);
begin
  update public.inquiries i
     set item_count     = (select count(*)                        from public.inquiry_items where inquiry_id = v_id),
         total_pieces   = (select coalesce(sum(quantity), 0)      from public.inquiry_items where inquiry_id = v_id),
         total_estimate = (select sum(quantity * unit_price)      from public.inquiry_items where inquiry_id = v_id and unit_price is not null)
   where i.id = v_id;
  return null;
end;
$$;

drop trigger if exists trg_inquiry_items_totals on public.inquiry_items;
create trigger trg_inquiry_items_totals
after insert or update or delete on public.inquiry_items
for each row execute function public.recalc_inquiry_totals();

-- ------------------------------------------------------------- admin allow-list
-- Deliberately has NO policies: it is unreachable through the REST API.
-- Rows are added by the site owner / service role only.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------------ security
alter table public.inquiries     enable row level security;
alter table public.inquiry_items enable row level security;

-- Buyers: create only. No read, no update, no delete.
revoke all on table public.inquiries     from anon;
revoke all on table public.inquiry_items from anon;
grant insert on table public.inquiries     to anon;
grant insert on table public.inquiry_items to anon;

drop policy if exists inquiries_public_insert on public.inquiries;
create policy inquiries_public_insert on public.inquiries
  for insert to anon, authenticated with check (true);

drop policy if exists inquiry_items_public_insert on public.inquiry_items;
create policy inquiry_items_public_insert on public.inquiry_items
  for insert to anon, authenticated with check (true);

-- Staff: read / update / delete, but only when the signed-in user is allow-listed.
drop policy if exists inquiries_staff_read on public.inquiries;
create policy inquiries_staff_read on public.inquiries
  for select to authenticated using (public.is_admin());

drop policy if exists inquiries_staff_update on public.inquiries;
create policy inquiries_staff_update on public.inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists inquiries_staff_delete on public.inquiries;
create policy inquiries_staff_delete on public.inquiries
  for delete to authenticated using (public.is_admin());

drop policy if exists inquiry_items_staff_read on public.inquiry_items;
create policy inquiry_items_staff_read on public.inquiry_items
  for select to authenticated using (public.is_admin());

drop policy if exists inquiry_items_staff_delete on public.inquiry_items;
create policy inquiry_items_staff_delete on public.inquiry_items
  for delete to authenticated using (public.is_admin());
