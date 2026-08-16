-- Run once in the Supabase SQL editor after setup.sql.
create table if not exists public.storefront_settings (
  id text primary key check (id = 'main'),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.storefront_settings enable row level security;
grant select, insert, update, delete on table public.storefront_settings to service_role;

insert into public.storefront_settings (id, settings)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
