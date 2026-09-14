-- Tighten execution privileges on the helper functions created in 0001.
-- Postgres grants EXECUTE to PUBLIC by default, which left both functions
-- callable through /rest/v1/rpc/<name>. Neither is a public endpoint:
--   * recalc_inquiry_totals() only ever runs as a trigger
--   * is_admin() must stay callable by `authenticated` (RLS policies call it)
--     but must not be callable by `anon`.
-- Applied: 2026-09-10

revoke all on function public.recalc_inquiry_totals() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
