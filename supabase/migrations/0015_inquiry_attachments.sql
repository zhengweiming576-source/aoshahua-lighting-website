-- Buyer attachments on the inquiry form (project photos, spec sheets, reference
-- renders, …). Both sites share this database, so it is applied ONCE.
--
-- Design notes:
--  * Files are small (client limits: max 3 files, 5 MB each) and the project has
--    no Storage setup, so they live as bytea on a per-inquiry table. They
--    cascade-delete with the inquiry.
--  * RLS mirrors the inquiry tables: buyers may INSERT only; they can never read
--    the bytes back. Staff read them through admin_inquiry_attachments()
--    (security definer + is_admin).
--  * Email (Brevo) carries the files as base64 attachments (20 MB per message);
--    the attachment array is merged into the payload only when non-empty.
--    WeCom markdown cannot carry files, so the chat card only reports the count.
--  * The two channel functions and the dispatcher are rebuilt from their LIVE
--    definition (pg_get_functiondef + replace + execute) — same technique as
--    0014 — so the long bodies are never re-copied into this file.
--
-- Applied: 2026-09-12

create table if not exists public.inquiry_attachments (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references public.inquiries(id) on delete cascade,
  file_name    text not null,
  mime_type    text,
  bytea_data   bytea not null,
  size_bytes   integer not null default 0 check (size_bytes >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists inquiry_attachments_inquiry_idx
  on public.inquiry_attachments (inquiry_id);

alter table public.inquiry_attachments enable row level security;
revoke all on table public.inquiry_attachments from anon, authenticated, public;
grant insert on table public.inquiry_attachments to anon, authenticated;

-- Same trust model as inquiry_items (with check (true)): the buyer is mid-
-- submission and the FK keeps the reference valid. No read path for non-admins.
drop policy if exists inquiry_attachments_public_insert
  on public.inquiry_attachments;
create policy inquiry_attachments_public_insert
  on public.inquiry_attachments for insert to anon, authenticated
  with check (true);

-- ------------------------------------------------------------------ admin ---
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
  select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'data_b64', encode(a.bytea_data, 'base64')
      ) order by a.id)
    into v_result
    from public.inquiry_attachments a
   where a.inquiry_id = p_inquiry;
  return v_result;
end;
$$;

revoke all on function public.admin_inquiry_attachments(uuid) from public, anon;
grant execute on function public.admin_inquiry_attachments(uuid) to authenticated;


-- ------------------------------------------------------------------ email ---
-- Adds a p_att count parameter, fetches the files as base64, and merges the
-- Brevo "attachment" array into the payload only when there is something.
drop function if exists public.notify_inquiry_email(public.inquiries, text, integer, numeric);

do $$
declare
  d  text;
  d2 text;
begin
  select pg_get_functiondef(oid) into d
    from pg_proc
   where proname = 'notify_inquiry_email'
     and pronamespace = 'public'::regnamespace;

  -- 1) signature
  d2 := replace(d, 'p_estimate numeric)', 'p_estimate numeric, p_att integer)');

  -- 2) local for the base64 attachment array
  d2 := replace(d2,
    '  v_key      text;' || chr(10) || '  v_to       jsonb;',
    '  v_key      text;' || chr(10) || '  v_to       jsonb;' || chr(10) || '  v_files    jsonb;');

  -- 3) fetch the buyer's files right before the http request (safe extensions only)
  d2 := replace(d2,
    '  begin' || chr(10) || '    perform net.http_post(',
    '  v_files := (select jsonb_agg(jsonb_build_object(''content'', encode(bytea_data, ''base64''), ''name'', file_name)' || chr(10) ||
                 '           filter (where file_name ~ ''\.(jpg|jpeg|png|gif|pdf|txt|doc|docx|xls|xlsx|zip|csv)$'') i)' || chr(10) ||
                 '    from public.inquiry_attachments' || chr(10) ||
                 '    where inquiry_id = p_inquiry.id);' || chr(10) ||
    '  begin' || chr(10) || '    perform net.http_post(');

  -- 4) merge the attachment array into the payload ({}::jsonb = no-op)
  d2 := replace(d2,
    '      ),' || chr(10) || '      timeout_milliseconds := 8000',
    '      ) || coalesce((select jsonb_build_object(''attachment'', v_files) where v_files is not null), ''{}''::jsonb),' || chr(10) ||
    '      timeout_milliseconds := 8000');

  -- 5) subject hint
  d2 := replace(d2,
    '''subject'', ''【新询盘】'' || p_inquiry.ref',
    '''subject'', ''【新询盘】'' || case when coalesce(p_att, 0) > 0 then ''（附 '' || p_att || '' 个附件）'' else '' end || p_inquiry.ref');

  -- 6) html hint (live formatting: \n + 10 spaces before the || line)
  d2 := replace(d2,
    chr(10) || '          || ''<p style="color:#8a6a2e">',
    chr(10) || '          || case when coalesce(p_att, 0) > 0 then ''<p><b>客户附件：</b>'' || p_att || '' 个（已附在本邮件中）</p>'' else '' end' || chr(10) ||
    '          || ''<p style="color:#8a6a2e">');

  execute 'create or replace function ' || d2;
  raise notice 'notify_inquiry_email rebuilt with attachment support';
end;
$$;

revoke all on function public.notify_inquiry_email(public.inquiries, text, integer, numeric, integer)
  from public, anon, authenticated;


-- ------------------------------------------------------------------ wecom ---
drop function if exists public.notify_inquiry_wecom(public.inquiries, text, integer, numeric);

do $$
declare
  d  text;
  d2 text;
begin
  select pg_get_functiondef(oid) into d
    from pg_proc
   where proname = 'notify_inquiry_wecom'
     and pronamespace = 'public'::regnamespace;

  -- 1) signature
  d2 := replace(d, 'p_estimate numeric)', 'p_estimate numeric, p_att integer)');

  -- 2) attachment count line above the freight note
  d2 := replace(d2,
    "|| E'\n\n<font color=""comment"">运费不含在报价内，需与客户另行协商确定。</font>'",
    "|| case when coalesce(p_att, 0) > 0 then E'\n**客户附件**：' || p_att || E' 个（请进后台查看下载）' else '' end" || chr(10) ||
    "|| E'\n\n<font color=""comment"">运费不含在报价内，需与客户另行协商确定。</font>'");

  execute 'create or replace function ' || d2;
  raise notice 'notify_inquiry_wecom rebuilt with attachment count';
end;
$$;

revoke all on function public.notify_inquiry_wecom(public.inquiries, text, integer, numeric, integer)
  from public, anon, authenticated;


-- ------------------------------------------------------------- dispatcher ---
-- Same signature (trigger), so CREATE OR REPLACE is enough — read first, then
-- rebuild, so the live body is what we transform.
do $$
declare
  d  text;
  d2 text;
begin
  select pg_get_functiondef(oid) into d
    from pg_proc
   where proname = 'notify_new_inquiry'
     and pronamespace = 'public'::regnamespace;

  d2 := replace(d,
    '  v_estimate numeric;',
    '  v_estimate numeric;' || chr(10) || '  v_att      integer;');

  d2 := replace(d2,
    '    perform public.notify_inquiry_email(v_inquiry, v_lines, v_pieces, v_estimate);',
    '    select coalesce(count(*)::int, 0) into v_att from public.inquiry_attachments where inquiry_id = v_id;' || chr(10) ||
    '    perform public.notify_inquiry_email(v_inquiry, v_lines, v_pieces, v_estimate, v_att);');

  d2 := replace(d2,
    '    perform public.notify_inquiry_wecom(v_inquiry, v_lines, v_pieces, v_estimate);',
    '    perform public.notify_inquiry_wecom(v_inquiry, v_lines, v_pieces, v_estimate, v_att);');

  execute 'create or replace function ' || d2;
  raise notice 'notify_new_inquiry dispatcher rebuilt';
end;
$$;

revoke all on function public.notify_new_inquiry() from public, anon, authenticated;
-- trg_inquiry_items_notify keeps pointing at public.notify_new_inquiry() —
-- unchanged return type, no re-creation needed.
