-- Online content editor storage. The public site can read the published row;
-- only allow-listed admin accounts can create or change it.
create table if not exists public.site_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_content enable row level security;

drop policy if exists "site content public read" on public.site_content;
drop policy if exists "site content admin insert" on public.site_content;
drop policy if exists "site content admin update" on public.site_content;

create policy "site content public read"
  on public.site_content for select to anon, authenticated
  using (id = 'main');

create policy "site content admin insert"
  on public.site_content for insert to authenticated
  with check (id = 'main' and public.is_admin());

create policy "site content admin update"
  on public.site_content for update to authenticated
  using (id = 'main' and public.is_admin())
  with check (id = 'main' and public.is_admin());

grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;

create or replace function public.set_site_content_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_content_updated_at on public.site_content;
create trigger site_content_updated_at
before update on public.site_content
for each row execute function public.set_site_content_updated_at();
