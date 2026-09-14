-- Emails a notification to the sales inbox as soon as an inquiry arrives.
--
-- Design notes:
--  * The whole thing lives in the database (pg_net + a trigger), so there is no
--    Edge Function to deploy and no agent has to poll on a schedule.
--  * The Brevo API key is NOT stored here. It is read at send time from Supabase
--    Vault under the name 'brevo_api_key', so the key is entered by the owner in
--    the dashboard and never appears in any file or chat.
--  * `notify_settings.enabled` starts false: nothing is sent until the owner has
--    stored the key and turned it on.
--  * The email is sent from the inquiry_items trigger (after the totals trigger
--    has run), because a row only becomes complete once its line items exist.
--  * Any failure is swallowed — a mail problem must never break a buyer's submit.
--
-- Applied: 2026-09-10

create extension if not exists pg_net;

create table if not exists public.notify_settings (
  id              integer primary key default 1 check (id = 1),
  enabled         boolean not null default false,
  sender_email    text,
  sender_name     text default 'Aoshahua Lighting Website',
  recipient_email text default '2596607017@qq.com',
  updated_at      timestamptz not null default now()
);

alter table public.notify_settings enable row level security;
revoke all on table public.notify_settings from anon, authenticated;

insert into public.notify_settings (id, enabled, recipient_email)
values (1, false, '2596607017@qq.com')
on conflict (id) do nothing;

create or replace function public.notify_new_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid := coalesce(new.inquiry_id, old.inquiry_id);
  v_settings public.notify_settings;
  v_inquiry  public.inquiries;
  v_key      text;
  v_lines    text;
  v_pieces   integer;
  v_estimate numeric;
  v_body     jsonb;
begin
  select * into v_settings from public.notify_settings where id = 1;
  if not coalesce(v_settings.enabled, false) or v_settings.sender_email is null then
    return null;
  end if;

  select * into v_inquiry from public.inquiries where id = v_id;
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

  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'brevo_api_key'
   limit 1;

  if v_key is null then
    return null;
  end if;

  v_body := jsonb_build_object(
    'sender', jsonb_build_object('name', coalesce(v_settings.sender_name, 'Aoshahua'), 'email', v_settings.sender_email),
    'to', jsonb_build_array(jsonb_build_object('email', v_settings.recipient_email)),
    'subject', '【新询盘】' || v_inquiry.ref || ' · ' || coalesce(nullif(v_inquiry.company, ''), v_inquiry.contact_name),
    'htmlContent',
      '<h2>收到新的询价单 ' || v_inquiry.ref || '</h2>'
      || '<p><b>公司：</b>' || coalesce(v_inquiry.company, '—') || '<br>'
      || '<b>联系人：</b>' || v_inquiry.contact_name || '<br>'
      || '<b>邮箱：</b>' || v_inquiry.email || '<br>'
      || '<b>国家 / 港口：</b>' || coalesce(v_inquiry.country, '—') || '<br>'
      || '<b>提交时间：</b>' || to_char(v_inquiry.created_at, 'YYYY-MM-DD HH24:MI') || '</p>'
      || '<p><b>产品明细</b><br>' || replace(coalesce(v_lines, '—'), E'\n', '<br>') || '</p>'
      || '<p><b>合计：</b>' || v_pieces || ' 件，预估货值 ¥'
      || coalesce(trim(to_char(v_estimate, 'FM999999990.00')), '—') || '</p>'
      || case when coalesce(v_inquiry.message, '') <> ''
              then '<p><b>客户留言：</b>' || v_inquiry.message || '</p>' else '' end
      || '<p style="color:#8a6a2e">运费不含在报价内，需与客户另行协商确定。</p>'
      || '<p>完整明细与状态跟进请登录后台：<a href="https://aoshahualighting.site.accio.ai/admin">https://aoshahualighting.site.accio.ai/admin</a></p>'
  );

  begin
    perform net.http_post(
      url     := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', v_key, 'content-type', 'application/json', 'accept', 'application/json'),
      body    := v_body,
      timeout_milliseconds := 8000
    );
    update public.inquiries set notified_at = now() where id = v_id;
  exception when others then
    -- never let an email failure break the buyer's submission
    null;
  end;

  return null;
end;
$$;

revoke all on function public.notify_new_inquiry() from public, anon, authenticated;

drop trigger if exists trg_inquiry_items_notify on public.inquiry_items;
create trigger trg_inquiry_items_notify
after insert on public.inquiry_items
for each row execute function public.notify_new_inquiry();
