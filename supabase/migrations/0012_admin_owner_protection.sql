-- 站点所有者保护：管理员之间可以互相授权/停用，但谁也停用不了「所有者」账号。
--
-- 背景：0011 的防呆只挡住了「取消自己」和「把最后一个管理员去掉」。实测发现一个真实隐患 ——
-- 用另一个管理员账号可以把站点主人（2596607017@qq.com）停用掉，导致自己被锁在自家后台外面。
-- 这里加一个 is_owner 标记：所有者只能由所有者本人（且仍受"不能取消自己"约束）处理，
-- 也就是说所有者账号实际不能再被停用。
--
-- Applied: 2026-09-10

alter table public.admins add column if not exists is_owner boolean not null default false;

-- 现有管理员里最早的那个就是站点主人（本项目只有 2596607017@qq.com）。
update public.admins
   set is_owner = true
 where user_id = (select a.user_id from public.admins a order by a.created_at asc limit 1)
   and not exists (select 1 from public.admins w where w.is_owner);

-- ------------------------------------------------------------ 账号列表 ---
-- 返回值多了 is_owner 一列，Postgres 不允许 create or replace 改返回类型，必须先 drop。
drop function if exists public.admin_list_accounts();

create or replace function public.admin_list_accounts()
returns table (
  user_id uuid,
  email text,
  granted boolean,
  is_owner boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, auth
as $$
begin
  if not public.is_admin() then
    raise exception '只有管理员可以查看账号列表';
  end if;

  return query
    select u.id,
           u.email::text,
           (a.user_id is not null),
           coalesce(a.is_owner, false),
           u.created_at,
           u.last_sign_in_at
      from auth.users u
      left join public.admins a on a.user_id = u.id
     order by coalesce(a.is_owner, false) desc, u.created_at;
end;
$$;

-- ------------------------------------------------------- 授权 / 停用 ---
create or replace function public.admin_set_access(p_user_id uuid, p_granted boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception '只有管理员可以修改权限';
  end if;

  select u.email::text into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception '账号不存在';
  end if;

  if coalesce(p_granted, false) then
    -- 重新授权时保留原有的 is_owner 标记
    insert into public.admins (user_id, email, is_owner)
    values (p_user_id, v_email, false)
    on conflict (user_id) do update set email = excluded.email;
  else
    if p_user_id = auth.uid() then
      raise exception '不能取消你自己的权限';
    end if;
    if exists (select 1 from public.admins a where a.user_id = p_user_id and a.is_owner)
       and not exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner) then
      raise exception '这是站点所有者的账号，只有他自己能取消';
    end if;
    if (select count(*) from public.admins) <= 1 then
      raise exception '至少要保留一个管理员';
    end if;
    delete from public.admins where user_id = p_user_id;
  end if;

  return jsonb_build_object('user_id', p_user_id, 'email', v_email, 'granted', coalesce(p_granted, false));
end;
$$;

-- 新加的账号一律不是所有者：外部调用不能自己把自己提成 owner。
create or replace function public.admin_create_account(
  p_email text,
  p_password text,
  p_grant boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
begin
  if not public.is_admin() then
    raise exception '只有管理员可以新增账号';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception '邮箱格式不对：%', coalesce(nullif(btrim(coalesce(p_email, '')), ''), '（空）');
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception '密码至少 8 位';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception '这个邮箱已经存在了：%', v_email;
  end if;

  -- ⚠️ 这些 token 字段必须是空字符串，不能是 NULL：GoTrue 把它们 Scan 进 Go 的
  -- string 类型，遇到 NULL 会抛 `converting NULL to string is unsupported`，
  -- 登录时表现为 HTTP 500 "Database error querying schema"。
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false,
    '', '', '', '', '', '', '', ''
  )
  returning id into v_id;

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text,
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(), now(), now()
  );

  if coalesce(p_grant, true) then
    insert into public.admins (user_id, email, is_owner) values (v_id, v_email, false)
    on conflict (user_id) do nothing;
  end if;

  return jsonb_build_object('user_id', v_id, 'email', v_email, 'granted', coalesce(p_grant, true));
end;
$$;

-- 重置密码：所有者与普通管理员都只能由管理员调用，逻辑不变。
create or replace function public.admin_reset_password(p_user_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
begin
  if not public.is_admin() then
    raise exception '只有管理员可以重置密码';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception '密码至少 8 位';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception '账号不存在';
  end if;

  return jsonb_build_object('user_id', p_user_id, 'updated', true);
end;
$$;

revoke all on function public.admin_list_accounts() from public, anon;
revoke all on function public.admin_create_account(text, text, boolean) from public, anon;
revoke all on function public.admin_set_access(uuid, boolean) from public, anon;
revoke all on function public.admin_reset_password(uuid, text) from public, anon;

grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_create_account(text, text, boolean) to authenticated;
grant execute on function public.admin_set_access(uuid, boolean) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
