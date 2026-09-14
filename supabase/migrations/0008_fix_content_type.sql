-- pg_net rejects any Content-Type other than exactly "application/json" (it
-- RAISEs, and the trigger's exception handler made that a silent failure). The
-- charset suffix added in 0007 broke sending; this restores the strict value
-- while keeping the whitespace-stripping hardening.
-- Applied: 2026-09-10
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
  v_to       jsonb;
  v_lines    text;
  v_pieces   integer;
  v_estimate numeric;
begin
  select * into v_settings from public.notify_settings where id = 1;
  if not coalesce(v_settings.enabled, false) or v_settings.sender_email is null then
    return null;
  end if;

  select * into v_inquiry from public.inquiries where id = v_id;
  if v_inquiry.id is null or v_inquiry.notified_at is not null then
    return null;
  end if;

  select jsonb_agg(jsonb_build_object('email', trim(address)))
    into v_to
    from unnest(string_to_array(coalesce(v_settings.recipient_email, ''), ',')) as address
   where trim(address) <> '';

  if v_to is null then
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

  -- Whitespace is stripped: a soft-wrapped paste would otherwise corrupt the header.
  select regexp_replace(decrypted_secret, '\s', '', 'g')
    into v_key
    from vault.decrypted_secrets
   where name = 'brevo_api_key'
   order by created_at desc
   limit 1;

  if v_key is null or v_key = '' then
    return null;
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
        'subject', '【新询盘】' || v_inquiry.ref || ' · '
                   || coalesce(nullif(v_inquiry.company, ''), v_inquiry.contact_name),
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
      ),
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
