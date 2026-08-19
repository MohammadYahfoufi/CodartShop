-- Run once in the Supabase SQL Editor to enable managed homepage banners.
create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  subtitle text not null default '' check (char_length(subtitle) <= 240),
  image_url text not null,
  image_path text not null,
  cta_label text not null default 'Shop now' check (char_length(cta_label) between 1 and 40),
  cta_href text not null default '/#products' check (char_length(cta_href) between 1 and 300),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hero_slides_order_idx
  on public.hero_slides(active, sort_order);

alter table public.hero_slides enable row level security;
grant select, insert, update, delete on table public.hero_slides to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('CodartlbShop', 'CodartlbShop', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ask PostgREST to refresh its schema immediately after creating the table.
notify pgrst, 'reload schema';
