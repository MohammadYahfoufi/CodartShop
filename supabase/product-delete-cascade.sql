-- Run once in the Supabase SQL Editor to cascade product deletion safely.
-- Active favorites and carts are deleted. Historical order line snapshots are
-- preserved, with product_id set to null by the foreign key.

alter table public.order_items drop constraint if exists order_items_product_id_fkey;
alter table public.order_items add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

create or replace function public.cascade_product_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.favorites where product_id = old.id::text;
  delete from public.cart_items where product_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists products_delete_cascade on public.products;
create trigger products_delete_cascade
before delete on public.products
for each row execute function public.cascade_product_delete();

revoke all on function public.cascade_product_delete() from public, anon, authenticated;
