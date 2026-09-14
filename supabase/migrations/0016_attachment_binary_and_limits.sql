-- Attachments: store the real bytes, accept more formats, allow bigger files.
--
-- Why (bug): the first cut sent the browser's base64 string straight at the
-- bytea column. Postgres reads a text -> bytea cast in *escape* format, so what
-- landed in the table was the ASCII of the base64 text (stored length = size x
-- 4/3, first bytes "iVBORw0KGg..."). admin_inquiry_attachments() then base64-ed
-- that again, the browser decoded one layer too few, and every attachment in the
-- backend showed up as a broken image. New writes go through
-- submit_inquiry_attachment(), which decodes on the server, and the rows written
-- the old way are repaired here.
--
-- The limits are set by the two channels that actually carry a file:
--   * the database: 5 files x 20 MB, 40 MB per inquiry (enforced on the form and
--     again in submit_inquiry_attachment());
--   * the email:    Brevo stops at 20 MB for the whole transactional message and
--     base64 inflates by 4/3, so only files <= 4 MB and <= 12 MB in total ride
--     along. Anything bigger waits in the backend and the mail says so.
--
-- Applied: 2026-09-12

-- 1. repair the rows written before the fix ---------------------------------
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
       -- base64 text is plain ASCII; a real binary file almost always contains a
       -- \NNN escape once written in escape format, so this test is decisive.
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

-- 2. the new write path -----------------------------------------------------
create or replace function public.submit_inquiry_attachment(
  p_inquiry  uuid,
  p_name     text,
  p_mime     text,
  p_data_b64 text
) returns void
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_bytes bytea;
  v_name  text;
begin
  -- Keep the stored name usable as a filename on every OS.
  v_name := regexp_replace(
    left(coalesce(nullif(trim(p_name), ''), 'attachment'), 160),
    '[\\/:*?"<>|\r\n\t]', '_', 'g');
  v_bytes := decode(coalesce(p_data_b64, ''), 'base64');
  if length(v_bytes) = 0 then
    raise exception 'attachment is empty';
  end if;
  -- Same ceiling the form enforces: a hand-rolled client cannot talk past it.
  if length(v_bytes) > 20971520 then
    raise exception 'attachment is larger than 20 MB';
  end if;
  insert into public.inquiry_attachments (inquiry_id, file_name, mime_type, bytea_data, size_bytes)
  values (p_inquiry, v_name, nullif(left(trim(coalesce(p_mime, '')), 120), ''), v_bytes, length(v_bytes));
end $$;

revoke all on function public.submit_inquiry_attachment(uuid, text, text, text) from public;
grant execute on function public.submit_inquiry_attachment(uuid, text, text, text) to anon, authenticated;

-- 3. admin reads: metadata first, bytes only when a file is opened ----------
create or replace function public.admin_inquiry_attachments(p_inquiry uuid)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    return null;
  end if;
  -- Metadata only: a 20 MB file must never be base64-ed into the list response.
  select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'created_at', a.created_at
      ) order by a.created_at, a.id)
    into v_result
    from public.inquiry_attachments a
   where a.inquiry_id = p_inquiry;
  return v_result;
end;
$$;

create or replace function public.admin_attachment_data(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_row jsonb;
begin
  if not public.is_admin() then
    return null;
  end if;
  select jsonb_build_object(
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'data_b64', encode(a.bytea_data, 'base64')
      )
    into v_row
    from public.inquiry_attachments a
   where a.id = p_id;
  return v_row;
end;
$$;

revoke all on function public.admin_attachment_data(uuid) from public, anon;
grant execute on function public.admin_attachment_data(uuid) to authenticated;

-- 4. the email carries only what Brevo can take -----------------------------
do $$
declare
  d  text;
  d2 text;
  d3 text;
begin
  select pg_get_functiondef(oid) into d
    from pg_proc
   where proname = 'notify_inquiry_email'
     and pronamespace = 'public'::regnamespace;

  if d is null then
    raise exception 'notify_inquiry_email not found';
  end if;

  -- 4a. replace the attachment payload with a size-capped, cumulative-capped,
  --     wider-format version. Matching on the block's ends (not on internal
  --     whitespace) keeps this from silently turning into a no-op.
  d2 := regexp_replace(
    d,
    'v_files := \(select jsonb_agg\(.*?where inquiry_id = p_inquiry\.id\);',
    $new$-- Only what the mail can actually carry: <= 4 MB a file and <= 12 MB in
  -- total, since base64 inflates by 4/3 and Brevo stops at 20 MB for the whole
  -- message. Larger files stay in the backend and the body says so.
  v_files := (select jsonb_agg(jsonb_build_object('content', encode(f.payload, 'base64'), 'name', f.file_name))
    from (select a.file_name,
                 a.bytea_data as payload,
                 sum(a.size_bytes) over (order by a.created_at, a.id) as running
            from public.inquiry_attachments a
           where a.inquiry_id = p_inquiry.id
             and a.size_bytes <= 4194304
             and strpos(a.file_name, '.') > 0
             and lower(split_part(a.file_name, '.', -1)) in ('jpg','jpeg','png','gif','webp','bmp','tif','tiff','heic','pdf','txt','csv','doc','docx','xls','xlsx','ppt','pptx','zip','rar','7z','dwg','dxf')) f
   where f.running <= 12582912);$new$);

  if d2 = d then
    raise exception 'notify_inquiry_email: attachment block anchor not found';
  end if;

  -- 4b. and the body has to be honest about anything left behind.
  d3 := replace(
    d2,
    $old$' 个（已附在本邮件中）</p>'$old$,
    $new$' 个' || case when coalesce(jsonb_array_length(v_files), 0) > 0
                       then '（本邮件随附 ' || jsonb_array_length(v_files) || ' 个，更大的附件请登录后台下载）'
                       else '（附件较大，请登录后台查看并下载）' end || '</p>'$new$);

  if d3 = d2 then
    raise exception 'notify_inquiry_email: attachment hint anchor not found';
  end if;

  -- pg_get_functiondef() already returns the whole CREATE OR REPLACE FUNCTION
  -- statement, so this runs it verbatim (prefixing it again would not parse).
  execute d3;
  raise notice 'notify_inquiry_email rebuilt with the size-capped attachment list';
end $$;

revoke all on function public.notify_inquiry_email(public.inquiries, text, integer, numeric, integer)
  from public, anon, authenticated;
