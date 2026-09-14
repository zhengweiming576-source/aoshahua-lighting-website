-- Pushes every new inquiry into a WeCom (企业微信) group chat through a group
-- robot webhook, alongside the existing email alert.
--
-- Design notes:
--  * Same shape as 0005/0008: pg_net + a trigger, no Edge Function to deploy and
--    no polling. The whole thing costs nothing to run.
--  * The webhook URL IS the credential (anyone holding it can post as the bot).
--    It is read at send time from Supabase Vault under the name
--    'wecom_webhook_key', so the owner pastes it in the dashboard and it never
--    appears in a file, a migration or a chat log.
--  * Email and WeCom are independent channels: switching one off, or losing one,
--    never affects the other. The trigger only collects the inquiry once and
--    hands the same data to both.
--  * `notified_at` now means "this inquiry has been dispatched" and is stamped by
--    the dispatcher. It stays the de-duplication guard: the trigger fires once
--    per inserted line item, and only the first firing may send.
--  * Any failure is swallowed — a chat or mail problem must never break a
--    buyer's submit.
--
-- Applied: 2026-09-10

create extension if not exists pg_net;

-- Per-channel switch. Email keeps its own gate in notify_settings.enabled.
alter table public.notify_settings
  add column if not exists wecom_enabled boolean not null default true;


-- Buyer-supplied text (company, contact, free-text message) must not be able to
-- restructure the message card, so the few markdown control characters are
-- dropped and all whitespace is collapsed onto one line.
create or replace function public.wecom_safe(p_text text)
returns text
language sql
immutable
as $$
  select btrim(
           regexp_replace(
             replace(replace(replace(replace(coalesce(p_text, ''), '*', ''), '`', ''), '[', '('), ']', ')'),
             '\s+',
             ' ',
             'g'
           )
         );
$$;

revoke all on function public.wecom_safe(text) from public, anon, authenticated;


-- ------------------------------------------------------------------ email ---

create or replace function public.notify_inquiry_email(
  p_inquiry  public.inquiries,
  p_lines    text,
  p_pieces   integer,
  p_estimate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.notify_settings;
  v_key      text;
  v_to       jsonb;
begin
  select * into v_settings from public.notify_settings where id = 1;
  if not coalesce(v_settings.enabled, false) or v_settings.sender_email is null then
    return;
  end if;

  select jsonb_agg(jsonb_build_object('email', trim(address)))
    into v_to
    from unnest(string_to_array(coalesce(v_settings.recipient_email, ''), ',')) as address
   where trim(address) <> '';

  if v_to is null then
    return;
  end if;

  -- Whitespace is stripped: a soft-wrapped paste would otherwise corrupt the header.
  select regexp_replace(decrypted_secret, '\s', '', 'g')
    into v_key
    from vault.decrypted_secrets
   where name = 'brevo_api_key'
   order by created_at desc
   limit 1;

  if v_key is null or v_key = '' then
    return;
  end if;

  begin
    perform net.http_post(
      url     := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object(
        'api-key', v_key,
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body    := jsonb_build_object(
        'sender', jsonb_build_object(
          'name', coalesce(v_settings.sender_name, 'Aoshahua Lighting Website'),
          'email', v_settings.sender_email
        ),
        'to', v_to,
        'subject', '【新询盘】' || p_inquiry.ref || ' · '
                   || coalesce(nullif(p_inquiry.company, ''), p_inquiry.contact_name),
        'htmlContent',
          '<h2>收到新的询价单 ' || p_inquiry.ref || '</h2>'
          || '<p><b>公司：</b>' || coalesce(p_inquiry.company, '—') || '<br>'
          || '<b>联系人：</b>' || p_inquiry.contact_name || '<br>'
          || '<b>邮箱：</b>' || p_inquiry.email || '<br>'
          || '<b>国家 / 港口：</b>' || coalesce(p_inquiry.country, '—') || '<br>'
          || '<b>提交时间：</b>' || to_char(p_inquiry.created_at, 'YYYY-MM-DD HH24:MI') || '</p>'
          || '<p><b>产品明细</b><br>' || replace(coalesce(p_lines, '—'), E'\n', '<br>') || '</p>'
          || '<p><b>合计：</b>' || p_pieces || ' 件，预估货值 ¥'
          || coalesce(trim(to_char(p_estimate, 'FM999999990.00')), '—') || '</p>'
          || case when coalesce(p_inquiry.message, '') <> ''
                  then '<p><b>客户留言：</b>' || p_inquiry.message || '</p>' else '' end
          || '<p style="color:#8a6a2e">运费不含在报价内，需与客户另行协商确定。</p>'
          || '<p>完整明细与状态跟进请登录后台：<a href="https://aoshahualighting.site.accio.ai/admin">https://aoshahualighting.site.accio.ai/admin</a></p>'
      ),
      timeout_milliseconds := 8000
    );
  exception when others then
    -- never let a mail failure break the buyer's submission
    null;
  end;
end;
$$;

revoke all on function public.notify_inquiry_email(public.inquiries, text, integer, numeric)
  from public, anon, authenticated;


-- ------------------------------------------------------------------ wecom ---

create or replace function public.notify_inquiry_wecom(
  p_inquiry  public.inquiries,
  p_lines    text,
  p_pieces   integer,
  p_estimate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.notify_settings;
  v_webhook  text;
  v_content  text;
begin
  select * into v_settings from public.notify_settings where id = 1;
  if not coalesce(v_settings.wecom_enabled, false) then
    return;
  end if;

  select regexp_replace(decrypted_secret, '\s', '', 'g')
    into v_webhook
    from vault.decrypted_secrets
   where name = 'wecom_webhook_key'
   order by created_at desc
   limit 1;

  -- No key yet, or a URL that is not the official group-robot endpoint: stay
  -- quiet rather than posting the inquiry somewhere unexpected.
  if v_webhook is null
     or v_webhook !~ '^https://qyapi\.weixin\.qq\.com/' then
    return;
  end if;

  v_content :=
       '## 新询盘 ' || public.wecom_safe(p_inquiry.ref)
    || E'\n> **公司**：'      || coalesce(nullif(public.wecom_safe(p_inquiry.company), ''), '—')
    || E'\n> **联系人**：'    || public.wecom_safe(p_inquiry.contact_name)
    || E'\n> **邮箱**：'      || public.wecom_safe(p_inquiry.email)
    || E'\n> **国家 / 港口**：' || coalesce(nullif(public.wecom_safe(p_inquiry.country), ''), '—')
    || E'\n> **提交时间**：'  || to_char(p_inquiry.created_at, 'YYYY-MM-DD HH24:MI')
    || E'\n\n**产品明细**'
    || E'\n' || coalesce(p_lines, '—')
    || E'\n\n**合计**：' || p_pieces || ' 件，预估货值 ¥'
       || coalesce(trim(to_char(p_estimate, 'FM999999990.00')), '—')
    || case when coalesce(btrim(p_inquiry.message), '') <> ''
            then E'\n**客户留言**：' || public.wecom_safe(p_inquiry.message) else '' end
    || E'\n\n<font color="comment">运费不含在报价内，需与客户另行协商确定。</font>'
    || E'\n[打开后台查看并跟进](https://aoshahualighting.site.accio.ai/admin)';

  -- The robot accepts at most 4096 bytes of markdown.
  if octet_length(v_content) > 4000 then
    v_content := left(v_content, 1200)
      || E'\n\n<font color="warning">明细过长已截断，请到后台查看完整内容。</font>';
  end if;

  begin
    perform net.http_post(
      url     := v_webhook,
      -- pg_net rejects any Content-Type other than exactly "application/json".
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'msgtype', 'markdown',
        'markdown', jsonb_build_object('content', v_content)
      ),
      timeout_milliseconds := 8000
    );
  exception when others then
    -- never let a chat failure break the buyer's submission
    null;
  end;
end;
$$;

revoke all on function public.notify_inquiry_wecom(public.inquiries, text, integer, numeric)
  from public, anon, authenticated;


-- ------------------------------------------------------------- dispatcher ---

create or replace function public.notify_new_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid := coalesce(new.inquiry_id, old.inquiry_id);
  v_inquiry  public.inquiries;
  v_lines    text;
  v_pieces   integer;
  v_estimate numeric;
begin
  begin
    select * into v_inquiry from public.inquiries where id = v_id;
    -- notified_at doubles as the "already dispatched" guard: the trigger fires
    -- once per inserted line item, and only the first firing may send.
    if v_inquiry.id is null or v_inquiry.notified_at is not null then
      return null;
    end if;

    select string_agg(
             item.product_name
               || coalesce(' (' || item.model || ')', '')
               || ' × ' || item.quantity
               || case when item.unit_price is null then '  单价：需报价'
                       else '  单价：¥' || trim(to_char(item.unit_price, 'FM999999990.00')) end,
             E'\n' order by item.product_name),
           coalesce(sum(item.quantity), 0),
           sum(case when item.unit_price is not null then item.unit_price * item.quantity end)
      into v_lines, v_pieces, v_estimate
      from public.inquiry_items item
     where item.inquiry_id = v_id;

    perform public.notify_inquiry_email(v_inquiry, v_lines, v_pieces, v_estimate);
    perform public.notify_inquiry_wecom(v_inquiry, v_lines, v_pieces, v_estimate);

    update public.inquiries set notified_at = now() where id = v_id;
  exception when others then
    -- a notification problem must never block the buyer's insert
    null;
  end;

  return null;
end;
$$;

revoke all on function public.notify_new_inquiry() from public, anon, authenticated;

-- trg_inquiry_items_notify keeps pointing at this function (same signature).
