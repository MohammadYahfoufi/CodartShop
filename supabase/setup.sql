-- Run this in the Supabase SQL editor once.
create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 600),
  image_url text not null,
  image_path text not null,
  price numeric(12, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('CodartlbShop', 'CodartlbShop', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The app uses the service role only in server-side Route Handlers.
-- Public visitors can read product rows and public bucket files, but cannot mutate them directly.
drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
on public.products for select
to anon, authenticated
using (true);
