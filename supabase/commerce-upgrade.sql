-- Run once in the Supabase SQL editor after setup.sql.
alter table public.products
  add column if not exists category text not null default 'Accessories',
  add column if not exists stock_quantity integer not null default 10 check (stock_quantity >= 0),
  add column if not exists sale_price numeric(12, 2) check (sale_price is null or sale_price >= 0),
  add column if not exists featured boolean not null default false,
  add column if not exists specifications jsonb not null default '{}'::jsonb,
  add column if not exists images jsonb not null default '[]'::jsonb;

update public.products
set images = jsonb_build_array(jsonb_build_object('url', image_url, 'path', image_path, 'alt', title))
where images = '[]'::jsonb and image_url <> '';

create index if not exists products_category_idx on public.products(category);
create index if not exists products_featured_idx on public.products(featured, created_at desc);
create index if not exists products_stock_idx on public.products(stock_quantity);

alter table public.orders
  add column if not exists customer_email text not null default '',
  add column if not exists delivery_address text not null default '',
  add column if not exists delivery_area text not null default 'beirut',
  add column if not exists delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  add column if not exists payment_method text not null default 'cash-on-delivery',
  add column if not exists subtotal numeric(12, 2) not null default 0 check (subtotal >= 0);

update public.orders set subtotal = greatest(0, total - delivery_fee) where subtotal = 0;
update public.orders set status = 'delivered' where status = 'fulfilled';

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'));
alter table public.orders drop constraint if exists orders_delivery_area_check;
alter table public.orders add constraint orders_delivery_area_check
  check (delivery_area in ('beirut', 'mount-lebanon', 'north', 'south', 'bekaa'));
alter table public.orders drop constraint if exists orders_payment_method_check;
update public.orders set payment_method = 'cash-on-delivery' where payment_method = 'bank-transfer';
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash-on-delivery', 'whish-money'));
