# Codart setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and run it once. This creates the product, order, order-item, and favorites tables, read policy, indexes, and public `CodartlbShop` image bucket.
3. Open **Project Settings → API Keys** and add the following to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SB_SECRET_KEY
NEXT_PUBLIC_WHATSAPP_NUMBER=9647501234567
```

`SUPABASE_SERVICE_ROLE_KEY` is also accepted for older Supabase projects. Keep either server key private and never prefix it with `NEXT_PUBLIC_`. The WhatsApp number must be in international format without `+`, spaces, or punctuation.

Run `npm install`, then `npm run dev`. The storefront is at `/`; product administration is at `/admin`.

Favorites are stored locally for instant use and synchronized to Supabase with an anonymous device ID. Checkout validates current prices on the server, stores the order and its line items, then opens WhatsApp with the saved order reference. The admin page lists recent orders and lets you update their status.

Product search runs through the products API and searches Supabase titles and descriptions. The SQL setup includes trigram indexes so partial-word searches remain fast as the catalog grows.

## Image pipeline

Admin uploads are resized in the browser to a maximum dimension of 1600 pixels and converted to WebP at 82% quality. The server stores images in the public `CodartlbShop` bucket and all product metadata in the Supabase `products` table.

## Security

The admin panel and product mutation endpoints intentionally have no authentication under the current requirements. Anyone who can reach the deployment can mutate products. Add authentication and server-side authorization before deploying publicly. The Supabase service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.
