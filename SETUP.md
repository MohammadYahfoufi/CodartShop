# Codart setup

1. Enable Firebase Firestore. The app uses a `products` collection for product metadata.
2. Create a public Supabase Storage bucket named `CodartlbShop`.
3. Add the following to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_WHATSAPP_NUMBER=9647501234567
```

The WhatsApp number must be in international format without `+`, spaces, or punctuation.

Run `npm install`, then `npm run dev`. The storefront is at `/`; product administration is at `/admin`.

## Image pipeline

Admin uploads are resized in the browser to a maximum dimension of 1600 pixels and converted to WebP at 82% quality. The server accepts only WebP files and stores them in the public `CodartlbShop` Supabase bucket. Product title, description, price, image URL, image path, and timestamps are stored in Firebase Firestore.

## Security

The admin panel and product mutation endpoints intentionally have no authentication under the current requirements. Anyone who can reach the deployment can mutate products. Add authentication and server-side authorization before deploying publicly. The Supabase service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.
