-- Attachments pasted in by a cached old client are still base64 text.
--
-- 0016 put an end to new writes going out as base64, but a browser that still has
-- the previous bundle cached keeps posting the base64 STRING at the bytea column
-- (Postgres reads that in escape format and stores the ASCII). Three files came in
-- that way after 0016 — including an .xlsx whose download would not open in Excel.
--
-- Rather than chase cached clients, the table now repairs itself on the way in:
-- anything that is plainly base64 text of exactly its declared size is decoded.
-- Same test the one-off repair used, so correctly stored bytes are never touched.
--
-- Applied: 2026-09-12

create or replace function public.fix_attachment_encoding()
returns trigger
language plpgsql
as $$
begin
  if new.bytea_data is not null
     and new.size_bytes > 0
     and length(new.bytea_data) between (new.size_bytes * 4 / 3) - 6 and (new.size_bytes * 4 / 3) + 6
     -- base64 text is plain ASCII; real bytes almost always contain a \NNN escape
     and encode(substring(new.bytea_data from 1 for 32), 'escape') ~ '^[A-Za-z0-9+/=]+$' then
    new.bytea_data := decode(encode(new.bytea_data, 'escape'), 'base64');
  end if;
  -- Always trust the bytes over whatever the client claimed.
  new.size_bytes := length(new.bytea_data);
  return new;
end $$;

drop trigger if exists trg_inquiry_attachments_fix_encoding on public.inquiry_attachments;
create trigger trg_inquiry_attachments_fix_encoding
  before insert or update on public.inquiry_attachments
  for each row execute function public.fix_attachment_encoding();

-- Repair the rows that arrived while a cached client was still in play.
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id
      from public.inquiry_attachments a
     where a.size_bytes > 0
       and length(a.bytea_data) between (a.size_bytes * 4 / 3) - 6 and (a.size_bytes * 4 / 3) + 6
       and encode(substring(a.bytea_data from 1 for 32), 'escape') ~ '^[A-Za-z0-9+/=]+$'
  loop
    update public.inquiry_attachments
       set bytea_data = decode(encode(bytea_data, 'escape'), 'base64')
     where id = r.id;
    update public.inquiry_attachments
       set size_bytes = length(bytea_data)
     where id = r.id;
    n := n + 1;
  end loop;
  raise notice 'attachment repair: % row(s) decoded from base64 text', n;
end $$;
