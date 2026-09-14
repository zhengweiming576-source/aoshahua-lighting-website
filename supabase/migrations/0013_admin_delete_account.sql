-- 后台账号「删除」：账号越攒越多的时候，直接把整个账号删掉。
--
-- 与 0011 的「停用」区别：
--   * 停用 = 只从 public.admins 里移除 → 还能登录，只是看不到数据，随时可以「授权」回来。
--   * 删除 = 连 auth.users 里的登录账号一起删掉 → 这个邮箱就彻底不存在了，不能再登录。
--
-- 关键约定：**不设黑名单**。删除就是把记录清干净，不写任何"禁止再注册"的标记。
-- 以后需要这个人回来，用同一个邮箱重新「新建账号」即可，和全新账号没有任何区别
-- （因为 auth.users 里那一行已经不存在，不会撞 users_email_partial_key 的唯一约束）。
--
-- 防呆：
--   * 不能删自己（删掉自己 = 当场被踢出后台）。
--   * 所有者账号（is_owner）谁都不能删，包括他自己 —— 删了站点就没人能进后台了。
--     所有者要交班，请在数据库里手工改 is_owner，不要从这里删。
--   * 删除后至少还留着一个管理员（所有者天然满足，这里只是兜底）。
--
-- Applied: 2026-09-10

create or replace function public.admin_delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception '只有管理员可以删除账号';
  end if;

  if p_user_id is null then
    raise exception '缺少账号 ID';
  end if;

  select u.email::text into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception '账号不存在（可能已经被删掉了）';
  end if;

  if p_user_id = auth.uid() then
    raise exception '不能删除当前登录的账号，请让另一个管理员来删';
  end if;

  if exists (select 1 from public.admins a where a.user_id = p_user_id and a.is_owner) then
    raise exception '这是站点所有者的账号，不能删除；如果要换主人，请在数据库里改 is_owner';
  end if;

  -- 该账号如果是已授权的管理员，删掉之后要保证还有别的管理员在。
  if exists (select 1 from public.admins a where a.user_id = p_user_id)
     and (select count(*) from public.admins) <= 1 then
    raise exception '至少要保留一个管理员';
  end if;

  -- 先清子表再清主表：不依赖外键的 on delete cascade，任何 Supabase 版本都不会中途报错。
  delete from public.admins where user_id = p_user_id;
  delete from auth.identities where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.users where id = p_user_id;

  if not found then
    raise exception '账号不存在（可能已经被删掉了）';
  end if;

  -- 不写任何黑名单/封禁记录：同一个邮箱随时可以重新「新建账号」。
  return jsonb_build_object('user_id', p_user_id, 'email', v_email, 'deleted', true);
end;
$$;

revoke all on function public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_delete_account(uuid) to authenticated;
