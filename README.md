# Sohoj Parenting | সহজ প্যারেন্টিং

A Bengali-first product storefront for **শিশুর মুখে ফুটুক বুলি**, a parenting ebook with 50 printable real-photo flashcards. The listed price is fixed at **৳249 BDT**.

## Project status

The storefront and checkout interface are implemented. Order submission, payment verification, and admin operations use Supabase Edge Functions and are intentionally unavailable until Supabase is configured. No payment is automatically verified, and the website never asks for a PIN, OTP, or password.

The supplied brand logo, ebook mockups, and permission-cleared customer review screenshots are included under `public/assets/` and used on the landing page. No standalone flashcard preview images were supplied, so the page does not present the ebook mockups as flashcard previews. Never put paid PDFs in `public/`.

## Requirements

- Node.js 20+
- A Supabase project for order submission and the admin dashboard

## Run locally

```sh
npm install
cp .env.example .env.local
npm run dev
```

The storefront is available at the Vite URL. Checkout and admin routes are hash routes (`/#/checkout`, `/#/admin`) to support static hosting without server-side rewrites.

## Build and preview

```sh
npm run build
npm run preview
```

The Vite base path defaults to `/ebook-flashcards/`, the GitHub Pages project-site path for this repository. For a different repository path, set `VITE_BASE_PATH` at build time (for example `VITE_BASE_PATH=/my-repo/ npm run build`). For a user/organization site at the domain root, use `/`.

To publish using GitHub Pages, configure the repository to deploy the `dist/` output from the branch/workflow you choose. This project does not deploy itself. Supabase functions must be deployed separately; a static GitHub Pages site cannot securely host server secrets or backend code.

## Supabase setup

1. Create a Supabase project and copy its project URL and **anon/publishable** key into `.env.local` using `.env.example`.
2. Link the Supabase CLI to the project, then apply `supabase/migrations/202611120001_initial_schema.sql`.
3. Configure and deploy the functions:

   ```sh
   supabase secrets set SITE_URL=https://YOUR-USERNAME.github.io/ebook-flashcards
   supabase functions deploy create-order
   supabase functions deploy admin-order-action
   supabase functions deploy create-delivery-link
   ```

   Keep the service-role key in Supabase's managed function environment only. Never put it in `VITE_*` variables or source control. The Supabase project provides the function runtime key automatically.
4. Create an administrator with Supabase Auth (Dashboard → Authentication → Users). Then, using the SQL editor as the project owner, add that user's UUID to `public.admin_users`:

   ```sql
   insert into public.admin_users (user_id)
   values ('AUTH_USER_UUID');
   ```

   Admin authorization is database-backed; merely signing in does not grant admin access.
5. Upload the ebook and full flashcard PDFs together as `bundle/sohoj-parenting.zip` to the **private** Supabase Storage bucket named `product-files`. The initial migration creates the bucket. Do not make it public. After comparing the actual incoming payment with the order details, an authorized admin verifies the payment, creates a seven-day signed link, sends it privately using WhatsApp/email, and records the delivery reference before marking the order delivered.
6. Configure the payment receiver number and account type in the checkout page's `src/config.ts` values. Account type is intentionally not assumed; verify the displayed instructions before launch. The number in the current brief is prefilled as `01860270024`.
7. Set `VITE_META_PIXEL_ID` only when a real Pixel ID is available. The integration does not send personal data. Purchase is emitted only as a result of an admin verification action and uses the order ID as the browser event ID. Pixel delivery is subject to browser consent/ad-blocking and is not a payment record.

The migration has row-level security enabled. Customers can submit orders only through the validating Edge Function and cannot read orders. Admins can read orders only after their Auth UUID is listed in `admin_users`. Status changes are made through the admin Edge Function, which enforces allowed transitions and records timestamps. Duplicate transaction IDs are rejected by a case-insensitive unique database constraint.

## Asset replacement

The landing page uses `logo.jpg` in the header and footer, `ebookvisual.jpg` in the hero, and the supplied ebook mockup in the product section. Customer review screenshots are displayed unchanged in their own section; publish them only with customer permission. Images use the configured Vite base path for GitHub Pages and retain their natural aspect ratios. No standalone flashcard preview was supplied. Do not publish the complete paid ebook or flashcard PDF; keep delivery files in the private Supabase Storage bucket.

## Payment and privacy checklist

- The amount is set to ৳249 in server-side order creation; no client-supplied amount is trusted.
- The form asks for customer name, email, WhatsApp/mobile, payment method, sender number, and transaction ID only. It never requests banking credentials.
- Payment remains `PENDING_VERIFICATION` until an administrator compares the actual receipt details and manually verifies it.
- Configure and verify the receiver account type and number before taking orders.
- Configure Auth redirect URLs and site URLs in Supabase for local and deployed domains.
- Product delivery files must remain private. Avoid placing customer or payment information in analytics, URLs, or public assets.

## Not configured in this repository

Supabase credentials, deployed functions, Auth users, storage files, payment receiver account type, and a Meta Pixel ID are not supplied. Until Supabase is configured, checkout clearly reports that order submission is unavailable; it does not simulate success.
