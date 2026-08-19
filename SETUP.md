# Codart setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and run it once. This creates the product, order, order-item, favorites, homepage slideshow, and daily analytics tables, plus their policies, indexes, aggregation function, and the public `CodartlbShop` image bucket.

For a project that was set up before account carts and order history were added, run `supabase/user-data-migration.sql` once in the SQL Editor. New projects only need `supabase/setup.sql`.

If Storage uploads succeed but banners do not appear, run `supabase/banner-migration.sql` once. It creates the `hero_slides` metadata table, repairs the `CodartlbShop` bucket configuration, and refreshes the API schema cache.
3. Open **Project Settings → API Keys** and add the following to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SB_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SB_SECRET_KEY
ADMIN_EMAILS=owner@example.com
NEXT_PUBLIC_WHATSAPP_NUMBER=9647501234567
GEMINI_API_KEY=your_server_only_gemini_key
GROQ_API_KEY=your_server_only_groq_key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted for projects that still use legacy anon keys. `SUPABASE_SERVICE_ROLE_KEY` is accepted for older server keys. Keep the secret/service-role key private and never prefix it with `NEXT_PUBLIC_`. Separate multiple admin emails with commas. The WhatsApp number must be in international format without `+`, spaces, or punctuation.

## Login setup

1. In **Supabase → Authentication → URL Configuration**, set your production Site URL and add `http://localhost:3000/auth/callback`, your LAN callback URL while testing, and your production `/auth/callback` URL to the redirect allow list.
2. Email magic-link login is enabled by default. Configure a custom SMTP provider before production so customer emails have reliable delivery.
3. In **Authentication → Providers → Google**, enable Google and paste the Google OAuth client ID and secret. In Google Cloud, use the Supabase callback URL displayed on that provider page as the authorized redirect URI.
4. Restart the Next.js server after changing `.env.local`. Customers sign in at `/login`; signed-in favourites are stored against their Supabase user ID.

### Branded login email

1. In **Supabase → Authentication → Email Templates**, open **Magic Link**.
2. Set the subject to `Your secure Codart sign-in code`.
3. Copy the complete contents of `supabase/email-templates/magic-link.html` into the template body and save it.
4. In **Authentication → SMTP Settings**, enable custom SMTP and enter the host, port, username, and password supplied by your email provider. Set the sender name to `Codart` and use a verified sender address such as `login@your-domain.com`.
5. Disable click/email tracking in the SMTP provider because rewritten authentication links can fail.

Changing the HTML controls the design. A custom SMTP provider is required to replace Supabase's sender name and is also required for reliable production delivery to customers outside the Supabase project team.

The supplied template displays Supabase's `{{ .Token }}` value as a verification code. Supabase supports codes from 6 to 10 digits, and the login page accepts that configured length on the device where sign-in was requested; the `/auth/callback` route remains in use for OAuth providers.

## Gemini voice assistant

Add `GEMINI_API_KEY` to `.env.local` and to the Vercel Production and Preview environments. Keep it server-only and never prefix it with `NEXT_PUBLIC_`. Signed-in customers can open **Talk to AI** on the storefront; the server exchanges the permanent key for a short-lived, single-use Gemini Live token, while microphone audio streams directly between the browser and Gemini.

The text chatbot uses Groq first and automatically retries with Gemini if Groq is missing, rate-limited, times out, or fails. If Gemini is selected as primary, it falls back to Groq in the same way. Calls are sequential, so a successful request consumes only one provider. The providers share the same live catalog/storefront knowledge rules. Defaults are Groq's production `openai/gpt-oss-20b` and `gemini-3.7-flash`; override them with the server-only `GROQ_CHAT_MODEL` and `GEMINI_CHAT_MODEL` variables. Set `AI_CHAT_PRIMARY_PROVIDER=gemini` to prefer Gemini; omit it or set it to `groq` to prefer Groq. The voice assistant continues to use Gemini Live only.

Run `supabase/ai-chat-security.sql` in the Supabase SQL Editor before enabling text chat. Text chat requires sign-in and atomically enforces 10 messages per user per hour, 30 per user per UTC day, 20 per network per hour, 60 per network per UTC day, and 500 total messages per UTC day. Override these defaults with `AI_CHAT_USER_HOURLY_LIMIT`, `AI_CHAT_USER_DAILY_LIMIT`, `AI_CHAT_NETWORK_HOURLY_LIMIT`, `AI_CHAT_NETWORK_DAILY_LIMIT`, and `AI_CHAT_GLOBAL_DAILY_LIMIT`. Set a private `AI_CHAT_RATE_LIMIT_SECRET` in production to control the keyed network hashes.

Run `supabase/ai-voice-security.sql` in the Supabase SQL Editor before enabling voice chat. It creates an RLS-protected usage ledger and an atomic quota function. Defaults are 5-minute calls, 2 calls per user per hour, 3 per user per UTC day, 3 per network per hour, 6 per network per day, and 30 total calls per UTC day. Override them with the `AI_VOICE_*` server environment variables documented in `app/api/ai/live-token/route.ts`. Network addresses are stored only as keyed hashes; set a separate `AI_VOICE_RATE_LIMIT_SECRET` in production if desired.

Both assistants receive a server-generated, read-only snapshot of up to 100 catalog products plus current storefront labels and contact details. Their AI providers receive product names, descriptions, categories, specifications, current prices, sale prices, and stock counts, but no database credentials or order, account, or admin tools. Customer-facing facts in `knowledge/` can supplement that snapshot for the text chatbot.

Run `npm install`, then `npm run dev`. The storefront is at `/`; the multi-page administration area starts at `/admin`.

Favorites are stored locally for instant use. Guests synchronize with an anonymous device ID; signed-in customers synchronize with their Supabase user ID so saved products follow their account. Checkout validates current prices on the server, stores the order and its line items, then opens WhatsApp with the saved order reference. The admin page lists recent orders and lets you update their status.

Product search runs through the products API and searches Supabase titles and descriptions. The SQL setup includes trigram indexes so partial-word searches remain fast as the catalog grows.

The admin page includes a homepage slideshow editor. Banner images are resized and converted to WebP in the browser, then stored in Supabase Storage (or `public/uploads` while running in local fallback mode).

## Lightweight analytics

The storefront batches page views and important clicks before sending them to `/api/analytics`. Supabase stores only one counter per day, metric, and event key—no IP addresses, user agents, visitor profiles, or individual event rows. A single batched RPC increments all queued counters, keeping database writes and storage usage low. View the 30-day dashboard at `/admin/analytics`.

## Image pipeline

Admin uploads are resized in the browser to a maximum dimension of 1600 pixels and converted to WebP at 82% quality. The server stores images in the public `CodartlbShop` bucket and all product metadata in the Supabase `products` table.

Product-image uploads first use `@imgly/background-removal` in the admin's browser to create a transparent foreground, then resize and encode the result as WebP. The first use downloads IMG.LY's medium model (about 80 MB) from IMG.LY's CDN; browsers cache it for later uploads. IMG.LY publishes this standalone package under the AGPL license, so confirm that its license terms fit the deployment or obtain another license from IMG.LY.

## Security

The admin pages and all product, banner, and order-status mutation endpoints require a verified Supabase session plus either an email listed in `ADMIN_EMAILS` or `app_metadata.role = "admin"`. Customer accounts cannot access them. The Supabase secret/service-role key remains server-only and must never use a `NEXT_PUBLIC_` prefix.
