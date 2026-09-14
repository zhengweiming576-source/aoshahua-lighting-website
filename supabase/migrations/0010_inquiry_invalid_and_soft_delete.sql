-- 后台询盘管理：新增「无效订单」状态，以及可恢复的软删除。
--
-- 设计说明：
--  * status 增加 'invalid'：无效询盘（垃圾询盘、重复提交、测试单）保留在列表里可查，
--    但不再计入累计件数、预估货值、产品排行与时间统计。
--  * 删除做成软删除（deleted_at 落时间戳），而不是真的 DELETE —— 误删还能在
--    「已删除」里一键恢复，历史询盘也不会因为一次误操作永久消失。
--  * RLS 不变：仍只有 admins 白名单里的登录用户能读/改，anon 只能插入。
--
-- Applied: 2026-09-10

alter table public.inquiries drop constraint if exists inquiries_status_check;

alter table public.inquiries
  add constraint inquiries_status_check check (status in ('new', 'handled', 'invalid'));

alter table public.inquiries add column if not exists deleted_at timestamptz;

comment on column public.inquiries.deleted_at is
  '软删除时间；非空表示已移入「已删除」，可在后台一键恢复';
