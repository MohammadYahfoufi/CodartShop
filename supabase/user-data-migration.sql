-- Run once in the Supabase SQL editor for an existing Codart database.
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_user_id_idx
  on public.orders(user_id, created_at desc);

create table if not exists public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists cart_items_user_id_idx
  on public.cart_items(user_id);

alter table public.cart_items enable row level security;
grant select, insert, update, delete on table public.cart_items to service_role;
