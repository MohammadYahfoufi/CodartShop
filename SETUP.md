# Codart setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and run it once. This creates the product, order, order-item, favorites, homepage slideshow, and daily analytics tables, plus their policies, indexes, aggregation function, and the public `CodartlbShop` image bucket.

For a project that was set up before account carts and order history were added, run `supabase/user-data-migration.sql` once in the SQL Editor. New projects only need `supabase/setup.sql`.
3. Open **Project Settings → API Keys** and add the following to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SB_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SB_SECRET_KEY
ADMIN_EMAILS=owner@example.com
NEXT_PUBLIC_WHATSAPP_NUMBER=9647501234567
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted for projects that still use legacy anon keys. `SUPABASE_SERVICE_ROLE_KEY` is accepted for older server keys. Keep the secret/service-role key private and never prefix it with `NEXT_PUBLIC_`. Separate multiple admin emails with commas. The WhatsApp number must be in international format without `+`, spaces, or punctuation.

## Login setup

1. In **Supabase → Authentication → URL Configuration**, set your production Site URL and add `http://localhost:3000/auth/callback`, your LAN callback URL while testing, and your production `/auth/callback` URL to the redirect allow list.
2. Email magic-link login is enabled by default. Configure a custom SMTP provider before production so customer emails have reliable delivery.
3. In **Authentication → Providers → Google**, enable Google and paste the Google OAuth client ID and secret. In Google Cloud, use the Supabase callback URL displayed on that provider page as the authorized redirect URI.
4. Restart the Next.js server after changing `.env.local`. Customers sign in at `/login`; signed-in favourites are stored against their Supabase user ID.

### Branded login email

1. In **Supabase → Authentication → Email Templates**, open **Magic Link**.
2. Set the subject to `Your secure Codart sign-in link`.
3. Copy the complete contents of `supabase/email-templates/magic-link.html` into the template body and save it.
4. In **Authentication → SMTP Settings**, enable custom SMTP and enter the host, port, username, and password supplied by your email provider. Set the sender name to `Codart` and use a verified sender address such as `login@your-domain.com`.
5. Disable click/email tracking in the SMTP provider because rewritten authentication links can fail.

Changing the HTML controls the design. A custom SMTP provider is required to replace Supabase's sender name and is also required for reliable production delivery to customers outside the Supabase project team.

The supplied template sends `token_hash` and `type=email` directly to the allowed `/auth/callback` URL. Keep those template variables intact; the callback supports both this server-side email flow and OAuth authorization codes.

Run `npm install`, then `npm run dev`. The storefront is at `/`; the multi-page administration area starts at `/admin`.

Favorites are stored locally for instant use. Guests synchronize with an anonymous device ID; signed-in customers synchronize with their Supabase user ID so saved products follow their account. Checkout validates current prices on the server, stores the order and its line items, then opens WhatsApp with the saved order reference. The admin page lists recent orders and lets you update their status.

Product search runs through the products API and searches Supabase titles and descriptions. The SQL setup includes trigram indexes so partial-word searches remain fast as the catalog grows.

The admin page includes a homepage slideshow editor. Banner images are resized and converted to WebP in the browser, then stored in Supabase Storage (or `public/uploads` while running in local fallback mode).

## Lightweight analytics

The storefront batches page views and important clicks before sending them to `/api/analytics`. Supabase stores only one counter per day, metric, and event key—no IP addresses, user agents, visitor profiles, or individual event rows. A single batched RPC increments all queued counters, keeping database writes and storage usage low. View the 30-day dashboard at `/admin/analytics`.

## Image pipeline

Admin uploads are resized in the browser to a maximum dimension of 1600 pixels and converted to WebP at 82% quality. The server stores images in the public `CodartlbShop` bucket and all product metadata in the Supabase `products` table.

## Security

The admin pages and all product, banner, and order-status mutation endpoints require a verified Supabase session plus either an email listed in `ADMIN_EMAILS` or `app_metadata.role = "admin"`. Customer accounts cannot access them. The Supabase secret/service-role key remains server-only and must never use a `NEXT_PUBLIC_` prefix.
