-- 后台自助账号管理：在 /admin 页面里直接新增登录账号、授权/停用、重置密码。
--
-- 设计说明：
--  * 浏览器只拿得到 anon key，创建 Auth 用户必须走服务端 —— 这里用 security definer
--    的数据库函数完成，不需要 Edge Function，也不需要把 service_role 放进前端。
--  * 四个函数第一件事都是校验调用者 public.is_admin()，所以即便 PostgREST 把 RPC
--    暴露出去，非管理员（甚至未登录）也调不动。
--  * 「新增账号」和「给不给权限」是两件事：新账号默认同时授权；也可以先建出来不授权，
--    那样他能登录成功但看不到任何数据。授权/停用随时由管理员在后台点。
--  * 防呆：不能取消自己的权限，也不能把最后一个管理员的权限去掉。
--
-- Applied: 2026-09-10

-- ------------------------------------------------------------ 账号列表 ---
create or replace function public.admin_list_accounts()
returns table (
  user_id uuid,
  email text,
  granted boolean,
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
           u.created_at,
           u.last_sign_in_at
      from auth.users u
      left join public.admins a on a.user_id = u.id
     order by u.created_at;
end;
$$;

-- ------------------------------------------------------------ 新建账号 ---
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

  -- 邮箱密码登录还需要一条 identities 记录（email 列是生成列，不能写）。
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text,
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(), now(), now()
  );

  if coalesce(p_grant, true) then
    insert into public.admins (user_id, email) values (v_id, v_email)
    on conflict (user_id) do nothing;
  end if;

  return jsonb_build_object('user_id', v_id, 'email', v_email, 'granted', coalesce(p_grant, true));
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
    insert into public.admins (user_id, email) values (p_user_id, v_email)
    on conflict (user_id) do nothing;
  else
    if p_user_id = auth.uid() then
      raise exception '不能取消你自己的权限';
    end if;
    if (select count(*) from public.admins) <= 1 then
      raise exception '至少要保留一个管理员';
    end if;
    delete from public.admins where user_id = p_user_id;
  end if;

  return jsonb_build_object('user_id', p_user_id, 'email', v_email, 'granted', coalesce(p_granted, false));
end;
$$;

-- ------------------------------------------------------------ 重置密码 ---
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

-- ---------------------------------------------------------------- 权限 ---
revoke all on function public.admin_list_accounts() from public, anon;
revoke all on function public.admin_create_account(text, text, boolean) from public, anon;
revoke all on function public.admin_set_access(uuid, boolean) from public, anon;
revoke all on function public.admin_reset_password(uuid, text) from public, anon;

grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_create_account(text, text, boolean) to authenticated;
grant execute on function public.admin_set_access(uuid, boolean) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
