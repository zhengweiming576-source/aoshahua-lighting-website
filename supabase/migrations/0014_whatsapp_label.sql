-- 询盘通知（邮件 + 企微卡片）里的「联系人」标签改成「WhatsApp」。
--
-- 背景：前台表单的 Contact name 已改成 WhatsApp number，买家填进来的是号码，
-- 通知里再写「联系人：+86 138…」会让人以为是姓名。
--
-- 做法：不重抄函数体（通知函数很长：邮件 HTML + 企微 markdown，整段复制容易抄错），
-- 而是把库里现成的定义取出来、只做一次字面量替换再重建。CREATE OR REPLACE FUNCTION
-- 会保留原有权限（ACL 不丢），所以 anon/authenticated 的授权不受影响。
do $$
declare
  v_def text;
  v_new text;
  v_name text;
  v_updated int := 0;
begin
  foreach v_name in array array['notify_inquiry_email', 'notify_inquiry_wecom']
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = v_name
     limit 1;

    if v_def is null then
      raise notice 'skip % (找不到这个函数)', v_name;
      continue;
    end if;

    v_new := replace(v_def, '<b>联系人：</b>', '<b>WhatsApp：</b>'); -- 邮件正文
    v_new := replace(v_new, '**联系人**', '**WhatsApp**');          -- 企微 markdown 卡片

    if v_new = v_def then
      raise notice 'skip % (没有可替换的标签)', v_name;
      continue;
    end if;

    execute v_new;
    v_updated := v_updated + 1;
    raise notice 'updated %', v_name;
  end loop;
  raise notice '共更新 % 个函数', v_updated;
end;
$$;

-- 复核：两个函数都应含 WhatsApp、不再含「联系人」
select p.proname                                       as function_name,
       (pg_get_functiondef(p.oid) like '%WhatsApp%')    as has_whatsapp,
       (pg_get_functiondef(p.oid) like '%联系人%')       as still_has_contact_label
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('notify_inquiry_email', 'notify_inquiry_wecom')
 order by p.proname;
