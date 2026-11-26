# সহজ প্যারেন্টিং — Supabase Production Setup Guide

এই গাইডটি বর্তমান কোড ও `supabase/migrations/202611120001_initial_schema.sql`, `supabase/migrations/202611120002_delivery_claims.sql` অনুযায়ী লেখা। Delivery claims migration production-এ প্রয়োগ ও যাচাই করা হয়েছে; এই guide-এর বাকি deploy/configuration নির্দেশনা স্বয়ংক্রিয়ভাবে করা হয়েছে—এমন ধরে নেবেন না। কোনো Supabase credentials, admin account বা product file এই repository-তে দেওয়া নেই।

## ১. বর্তমান ইন্টিগ্রেশন কীভাবে কাজ করে

- Checkout থেকে `create-order` Edge Function-এ অর্ডার যায়। সার্ভার নিজে ৳249 সেট করে এবং অর্ডারকে `PENDING_VERIFICATION` রাখে। Checkout-এ দেওয়া পরিমাণকে সার্ভার বিশ্বাস করে না।
- গ্রাহকের bKash/Nagad Send Money পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই হয় না। একজন অনুমোদিত admin প্রকৃত পেমেন্ট, প্রেরকের নম্বর ও Transaction ID মিলিয়ে `Verify` করলে তবেই অর্ডার `VERIFIED` হয়।
- Admin dashboard-এ Supabase Auth email/password login আছে। Admin হতে হলে Auth user-এর UUID-কে `public.admin_users`-এ যোগ করতে হয়। শুধু login করলেই admin হওয়া যায় না।
- `admin-order-action` ও `create-delivery-link` Bearer token যাচাই করে এবং `admin_users`-এ membership না থাকলে কাজ করে না।
- `create-delivery-link` কেবল `VERIFIED` বা `DELIVERED` অর্ডারের জন্য 256-bit random claim token তৈরি করে; database-এ শুধু SHA-256 hash থাকে। নতুন claim তৈরির আগে আগের unrevoked claim বাতিল হয় এবং claim ৭ দিন পর মেয়াদোত্তীর্ণ হয়।
- `get-customer-delivery` public claim token যাচাই করে এবং কেবল বৈধ claim-এর জন্য server-side Drive URL secrets ফেরত দেয়। Claim token-টিই customer authorization; endpoint-এ Supabase user JWT বাধ্যতামূলক নয়।
- Migration-এ `orders`, `admin_users` ও `delivery_claims`-এর RLS চালু; `delivery_claims` কেবল service role দিয়ে ব্যবহারযোগ্য। গ্রাহকের অর্ডার তৈরি হয় Edge Function-এর server-side service client দিয়ে।
- Functions-এর `verify_jwt` config-এ `false`; admin functions নিজেরা Bearer token-কে Supabase Auth দিয়ে যাচাই করে এবং database membership পরীক্ষা করে। `create-order` ও `get-customer-delivery` যথাক্রমে checkout এবং claim-token-ভিত্তিক public endpoint।
- CORS allowlist-এ local Vite origin এবং `SITE_URL` থাকে। CORS কোনো authentication বা abuse protection নয়। `create-order`-এ rate limit/CAPTCHA নেই; ভুয়া/অতিরিক্ত order ঠেকাতে production বিজ্ঞাপন চালুর আগে এই ঝুঁকি বিবেচনা করুন।
- Admin UI পেমেন্ট যাচাই, delivery reference ও claim link তৈরি করে; ক্রেতা claim link খুলে ebook PDF, flashcards PDF বা Drive folder-এ যায়। Claim link ব্যক্তিগতভাবে পাঠাবেন।

## ২. কোন environment variable লাগবে

### Frontend build-এর সময়

| Variable | বাধ্যতামূলক? | কোথায় পাবেন / কী কাজে লাগে |
|---|---|---|
| `VITE_SUPABASE_URL` | হ্যাঁ | Supabase project-এর URL, যেমন `https://PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | হ্যাঁ | Dashboard-এর public `anon`/publishable key। এটি frontend bundle-এ থাকবে; RLS-এর বিকল্প নয়। |
| `VITE_BASE_PATH` | না | custom domain/root site-এর জন্য default `/`; GitHub Pages project-site path হলে সেট করুন। |
| `VITE_META_PIXEL_ID` | না | শুধু বাস্তব Meta Pixel থাকলে; না থাকলে ফাঁকা রাখুন। |

এই variable-গুলোর নাম `VITE_` দিয়ে শুরু হওয়ায় build-এর পরে browser-এ দেখা যায়। এখানে শুধু public project URL ও public anon/publishable key দিন। **Service-role key, database password, Supabase access token বা অন্য secret কখনো `VITE_` variable-এ দেবেন না।**

Local development-এ:

```sh
cp .env.example .env.local
```

`.env.local` খুলে `VITE_SUPABASE_URL` ও `VITE_SUPABASE_ANON_KEY`-এ নিজের project-এর মান বসান। এটি `.gitignore`-এ উপেক্ষিত; তবু `git status` দেখে নিশ্চিত হোন যেন `.env.local` commit করার তালিকায় না আসে। `.env.example`-এ কখনো আসল key লিখবেন না।

### Edge Functions-এর জন্য

- `SITE_URL`: production website-এর URL। Function CORS এই origin allow করতে এটি ব্যবহার করে। GitHub Pages হলে নিজের সঠিক URL দিন, যেমন `https://YOUR_GITHUB_USERNAME.github.io/ebook-flashcards`। Custom domain হলে সেটির URL দিন।
- `DRIVE_FOLDER_URL`, `DRIVE_EBOOK_URL`, `DRIVE_FLASHCARDS_URL`: customer delivery-র জন্য যথাক্রমে Drive folder, ebook PDF ও flashcards PDF-এর HTTPS URL। এগুলো Supabase Edge Function secrets হিসেবে server-side-এ রাখুন; কোনো `VITE_` variable, source file বা frontend build-এ দেবেন না।
- Supabase Edge Functions-এর runtime-এ `SUPABASE_URL`, `SUPABASE_ANON_KEY` এবং `SUPABASE_SERVICE_ROLE_KEY` Supabase সরবরাহ করে। এই repository-র functions এগুলো ব্যবহার করে। সাধারণত এগুলো আলাদাভাবে সেট করতে হয় না।
- `SITE_URL` secret হিসেবে CLI দিয়ে সেট করা হবে, যদিও URL-টি নিজে গোপন তথ্য নয়।

**`SUPABASE_SERVICE_ROLE_KEY` কখনো frontend, `.env.local`, GitHub Pages artifact, README, screenshot, chat বা Git-এ দেবেন না।** এটি server-side privileges দেয় এবং RLS bypass করতে পারে।

### Environment variable নয়—কোডে থাকা production values

- Receiver number `01860270024` ও `accountType` আছে [src/config.ts](/workspaces/ebook-flashcards/src/config.ts)-এ। Account type এখনো নিশ্চিত করা হয়নি; bKash/Nagad account type যাচাই না করে বাস্তব পেমেন্ট চালু করবেন না।
- মূল্য ৳249 frontend config, `create-order` function, SQL migration—তিন জায়গায় fixed. মূল্য পাল্টালে migration/constraint-সহ code review দরকার; শুধু frontend বদলালে হবে না।
- সম্পূর্ণ product file public assets-এ নেই। Customer delivery-র Drive URL-গুলো শুধু server-side Edge Function secrets-এ রাখুন।

## ৩. Supabase project তৈরি ও CLI প্রস্তুত

1. Supabase Dashboard-এ নতুন project তৈরি করুন। Project region, database password এবং project ref নিরাপদ password manager-এ রাখুন। Database password কোনো command history বা Git file-এ লিখবেন না।
2. Project URL/API page থেকে URL ও public anon/publishable key নিন। `service_role` key-কে ভুল করে public key মনে করবেন না।
3. Repository root-এ terminal খুলে CLI version পরীক্ষা করুন:

   ```sh
   npx supabase@latest --version
   ```

4. Supabase CLI-তে login করে project link করুন:

   ```sh
   npx supabase login
   ```

   Browser-এ login সম্পন্ন করুন। এরপর project ref বসিয়ে:

   ```sh
   PROJECT_REF="PASTE_YOUR_PROJECT_REF_HERE"
   npx supabase link --project-ref "$PROJECT_REF"
   ```

   CLI চাইলে database password শুধু interactive prompt-এ দিন। সেটি source file, shell script বা Git-এ রাখবেন না।

## ৪. SQL migration প্রয়োগ

Project-টি নতুন/পরিষ্কার হলে repository root থেকে চালান:

```sh
npx supabase db push
```

CLI নতুন project-এ `supabase/migrations/202611120001_initial_schema.sql` ও `supabase/migrations/202611120002_delivery_claims.sql` ক্রমানুসারে প্রয়োগ করবে। Dashboard-এর SQL Editor-এ একই migration বারবার paste করবেন না; migration tracking ব্যবহার করুন। Project-এ আগে থেকেই `orders`, `admin_users`, policies বা Storage setup থাকলে আগে schema পর্যালোচনা/backup নিন—initial migration-টি fresh project-এর জন্য ধরে নেওয়া হয়েছে এবং policy-গুলোর `CREATE POLICY` অংশ পুনরায় চালানোর জন্য idempotent নয়।

Migration-এর ফল:

- `orders`, `admin_users` tables ও indexes
- `delivery_claims` table, unique active-claim index ও service-role-only grants
- উভয় table-এ RLS
- `orders` পড়ার অনুমতি শুধু `admin_users`-এ থাকা authenticated admin-এর জন্য
- customer role-কে `orders`-এ সরাসরি insert/update/delete privilege না দেওয়া
- private `product-files` bucket; সর্বোচ্চ file size 50 MB; PDF/ZIP MIME type
- Storage object-এর কোনো public read policy নয়

## ৫. Site URL ও Auth settings

### Edge Function CORS origin

Production URL বসিয়ে function secret সেট করুন:

```sh
SITE_URL="https://YOUR_GITHUB_USERNAME.github.io/ebook-flashcards"
npx supabase secrets set SITE_URL="$SITE_URL"
```

GitHub Pages path-সহ URL-টি project-এর URL-এর সঙ্গে মেলে কিনা যাচাই করুন। Function-এ `SITE_URL`-এর origin তুলনা হয়; domain/hostname-এ typo থাকলে production checkout/admin function browser-origin request প্রত্যাখ্যান করবে। Local `http://localhost:5173` ও preview `http://localhost:4173` আগে থেকেই allowlist-এ আছে।

### Supabase Auth URL configuration

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** production site URL দিন; GitHub Pages হলে `/ebook-flashcards/` path-সহ।
- **Redirect URLs:** প্রয়োজনমতো production URL এবং `http://localhost:5173/**` যোগ করুন। Supabase Auth-এর password login-এ redirect প্রয়োজন না হলেও local/production URL সঠিক রাখা ভালো।
- **Authentication → Providers:** Email provider সক্রিয় রাখুন।
- যদি গ্রাহকদের website-এ account তৈরির দরকার না থাকে, **Allow new users to sign up** বন্ধ রাখুন। Admin membership না থাকলে নতুন Auth user অর্ডার পড়তে পারবে না, তবু অপ্রয়োজনীয় signup বন্ধ রাখা ভালো।

## ৬. প্রথম admin account নিরাপদে তৈরি

1. Dashboard → **Authentication → Users → Add user** থেকে নিজের নিয়ন্ত্রিত admin email দিয়ে user তৈরি করুন। দীর্ঘ, unique password password manager-এ রাখুন। Password বা reset link কারও সঙ্গে শেয়ার করবেন না।
2. তৈরি user-এর UUID কপি করুন—email নয়।
3. Dashboard → **SQL Editor**-এ নিচের SQL চালিয়ে placeholder-টি UUID দিয়ে বদলান:

   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE_AUTH_USER_UUID_HERE')
   on conflict (user_id) do nothing;
   ```

   এই SQL শুধু project owner হিসেবে trusted SQL Editor-এ চালান। `admin_users`-এ customer/admin role দেওয়ার কোনো public API নেই।
4. Frontend build-এ public Supabase URL/key দেওয়ার পর site-এর `/#/admin` খুলে admin email/password দিয়ে sign in করুন। Membership না থাকলে dashboard order দেখাবে না।
5. Supabase dashboard-এ MFA উপলভ্য থাকলে admin account-এ চালু করুন। অপ্রয়োজনীয় admin user তৈরি করবেন না।

## ৭. Google Drive customer delivery

1. Drive-এ ebook PDF ও সম্পূর্ণ flashcards PDF রাখুন এবং তিনটি URL (`DRIVE_FOLDER_URL`, `DRIVE_EBOOK_URL`, `DRIVE_FLASHCARDS_URL`) ঠিকমতো খোলে কিনা যাচাই করুন।
2. Supabase Edge Function secrets-এ এই তিনটি HTTPS URL যোগ করুন। URL-গুলো frontend source বা `VITE_` build variable-এ রাখবেন না।
3. Drive sharing setting অনুযায়ী customer-কে ফাইল দেখার/ডাউনলোডের অনুমতি দিতে হবে। Claim link সাত দিন পর expire করে; Drive URL নিজেই আলাদা access control নয়, তাই সংশ্লিষ্ট ক্রেতাকে ব্যক্তিগত claim link পাঠান।

## ৮. Edge Functions deploy

প্রথমে প্রয়োজনীয় migration ও `SITE_URL`, `DRIVE_FOLDER_URL`, `DRIVE_EBOOK_URL`, `DRIVE_FLASHCARDS_URL` secrets প্রস্তুত করুন। তারপর repository root থেকে প্রতিটি function deploy করুন:

```sh
npx supabase functions deploy create-order
npx supabase functions deploy admin-order-action
npx supabase functions deploy create-delivery-link
npx supabase functions deploy get-customer-delivery
```

`supabase/config.toml` অনুযায়ী এই চার function-এ platform JWT verification বন্ধ। এটি ভুলে যাওয়া নয়:

- `create-order` customer checkout-এর public endpoint; function input validate করে এবং server-side service key দিয়ে fixed-price order তৈরি করে।
- `admin-order-action` এবং `create-delivery-link`-এ code নিজে Bearer access token যাচাই করে এবং `admin_users` membership পরীক্ষা করে। Admin membership ছাড়া কাজ করা উচিত নয়।
- `get-customer-delivery` user JWT-এর বদলে claim token hash যাচাই করে; invalid, expired বা revoked claim-এ Drive URL ফেরত দেয় না।
- Supabase-এর built-in service-role key শুধু Edge Function runtime-এ থাকবে; deploy command-এ key যোগ করবেন না।

Deploy শেষে Dashboard → **Edge Functions → Logs**-এ error আছে কিনা দেখুন। Live endpoint URL/secret screenshot বা public report-এ দেবেন না।

## ৯. Frontend-কে project-এ যুক্ত করা

Local test-এর জন্য `.env.local`-এ শুধু public URL ও anon/publishable key বসিয়ে:

```sh
npm run dev
```

`http://localhost:5173` থেকে checkout/admin test করুন। Local origin function allowlist-এ আছে।

Production Pages build-এ একই দুইটি `VITE_` variable **build চালানোর সময়** দিতে হবে; Vite এগুলো JavaScript bundle-এ compile করে। GitHub Actions ব্যবহার করলে repository **Variables/Secrets**-এ public URL ও public anon/publishable key রাখুন এবং `npm run build` step-এর environment-এ দিন। এই repository-তে বর্তমান সময়ে GitHub Pages deployment workflow নেই; Pages build/publish ব্যবস্থা আলাদাভাবে configure করতে হবে। Service-role key কখনো GitHub Actions frontend build-এ দেবেন না।

এই project-এর default base path `/`, custom domain `parentura.online`-এর জন্য। GitHub Pages project-site path ব্যবহার করলে build-এর সময় `VITE_BASE_PATH` সেট করুন। Production frontend build পুনরায় publish না করা পর্যন্ত নতুন `.env.local`/GitHub build variable live site-এ কার্যকর হবে না।

Build যাচাই:

```sh
npm run build
```

## ১০. RLS ও customer order privacy যাচাই

### SQL policy inventory

Dashboard → SQL Editor-এ চালান:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where (schemaname = 'public' and tablename in ('orders', 'admin_users'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename;
```

`public.orders` ও `public.admin_users`-এর `rowsecurity` অবশ্যই `true` হবে। Storage objects-এ Supabase RLS enabled থাকা উচিত।

Policy তালিকা:

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('orders', 'admin_users'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```

প্রত্যাশিত:

- `orders`: authenticated admin membership যাচাই করা `SELECT` policy; anon/customer-এর জন্য `INSERT`, `UPDATE`, `DELETE` policy নেই।
- `admin_users`: signed-in user শুধু নিজের `user_id` row দেখতে পারে।
- `storage.objects`: customer বা anon-কে `product-files` পড়তে দেয় এমন policy নেই।

অনাকাঙ্ক্ষিত অতিরিক্ত policy থাকলে project-এ customer data দেওয়ার আগে তা পর্যালোচনা করুন। SQL Editor owner privileges ব্যবহার করতে পারে—তাই SQL Editor থেকে `select * from orders` চালিয়ে customer privacy পরীক্ষা করবেন না; এটি RLS bypass করতে পারে।

### বাস্তব non-admin API পরীক্ষা

এই test-এর জন্য staging project-এ অন্তত একটি বাস্তব test order থাকতে হবে এবং **`public.admin_users`-এ নেই** এমন test Auth user তৈরি থাকতে হবে। Test account-কে `/#/admin`-এ sign in করালে order list দেখতে না পাওয়া উচিত।

আরও সরাসরি পরীক্ষা করতে repository root-এর terminal-এ নিচের script চালান। এটি `.env.local`-এর public URL/key পড়বে, test user-এর password terminal-এ গোপনে চাইবে, anon access প্রত্যাখ্যাত হচ্ছে কিনা এবং non-admin user-এর query শূন্য order দিচ্ছে কিনা পরীক্ষা করবে। Supabase SQL Editor দিয়ে নয়, API-তে পরীক্ষা হয়।

```sh
set -a
. ./.env.local
set +a

read -r -p "Non-admin test email: " TEST_USER_EMAIL
read -r -s -p "Non-admin test password: " TEST_USER_PASSWORD
printf '\n'
export TEST_USER_EMAIL TEST_USER_PASSWORD

node --input-type=module <<'NODE'
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key || !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
  throw new Error('Supabase public config বা test user তথ্য পাওয়া যায়নি।');
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anonymous = createClient(url, key, options);
const anonymousRead = await anonymous.from('orders').select('id').limit(1);
if (anonymousRead.error?.code !== '42501') {
  throw new Error('FAIL: anon role orders পড়তে পেরেছে; RLS/grants পরীক্ষা করুন।');
}
console.log('PASS: anon role orders পড়তে পারেনি।');

const customer = createClient(url, key, options);
const { error: loginError } = await customer.auth.signInWithPassword({
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
});
if (loginError) throw loginError;

const { data, error } = await customer.from('orders').select('id').limit(1);
if (error) throw error;
if (data.length !== 0) {
  throw new Error('FAIL: non-admin account অন্তত একটি order দেখতে পেয়েছে; সঙ্গে সঙ্গে RLS পরীক্ষা করুন।');
}
console.log('PASS: non-admin authenticated user কোনো order দেখতে পায়নি।');
await customer.auth.signOut();
NODE

unset TEST_USER_EMAIL TEST_USER_PASSWORD
```

Test শেষে staging test user মুছে ফেলুন বা disable করুন। Test account-কে কখনো `admin_users`-এ যুক্ত করবেন না। API test-এ কোনো order দেখা গেলে production launch বন্ধ রেখে policy/grant তদন্ত করুন।

## ১১. বাস্তব payment দিয়ে end-to-end পরীক্ষা

এই checkout **manual Send Money**; repository-তে bKash/Nagad sandbox বা payment simulator নেই। Fake Transaction ID দিয়ে পেমেন্ট যাচাই test করবেন না।

1. সম্ভব হলে আলাদা Supabase **staging project**-এ migration, admin, Drive URL secrets, `SITE_URL` ও functions configure করুন।
2. Receiver number `01860270024` এবং account type-এর মালিকানা/ধরন আগে নিশ্চিত করুন। নিজের নিয়ন্ত্রিত sender account থেকে নিজের/অনুমোদিত receiver account-এ ৳249-এর একটি প্রকৃত Send Money test করুন। Provider-এর app/statement-এ receiver, amount ও Transaction ID মিলে যাওয়া নিশ্চিত করুন।
3. Staging website-এ checkout পূরণ করে প্রকৃত payment method, sender number ও বাস্তব Transaction ID দিন। PIN/OTP/password কখনো কোনো form-এ দেবেন না।
4. Admin dashboard-এ `PENDING_VERIFICATION` order আসা উচিত। Payment provider-এ বাস্তব লেনদেন independently মিলিয়ে দেখে তবেই `Verify` চাপুন। Verify-এর আগে delivery link তৈরি বা file পাঠানো যাবে না।
5. `VERIFIED` order-এ ৭ দিনের claim link তৈরি করুন; customer route-এ তিনটি Drive link খোলে কিনা পরীক্ষা করুন। একই order-এর জন্য নতুন claim তৈরি করলে পুরোনো claim বাতিল হয় কিনা staging-এ যাচাই করুন। Customer-facing message-এ link-টি ব্যক্তিগতভাবে পাঠান, তারপর delivery reference লিখে `ডেলিভার হয়েছে` চিহ্নিত করুন।
6. Non-admin RLS test চালিয়ে নিশ্চিত করুন staging test order customer account-এ দেখা যায় না। Staging-এ order log, function logs এবং Storage access-ও দেখে নিন।
7. Test টাকা ফেরত দিতে হলে payment provider-এর অনুমোদিত পদ্ধতিতে আলাদা refund করুন; website নিজে refund process করে না।

নিজস্ব প্রকৃত payment test করা সম্ভব না হলে complete payment-verification workflow পরীক্ষিত হয়েছে বলে দাবি করবেন না। সে ক্ষেত্রে production চালুর আগে provider-এর পরীক্ষার উপায়/নির্দেশনা নিন এবং admin verification/delivery-কে এখনও untested হিসেবে ধরুন।

## ১২. Production চালুর আগে হাতে-কলমে checklist

- [ ] Supabase project তৈরি, project ref ও database password নিরাপদে সংরক্ষণ।
- [ ] `VITE_SUPABASE_URL` ও public anon/publishable key local/production **build environment**-এ বসানো; কোনো service-role key frontend-এ নেই।
- [ ] SQL migration একবার প্রয়োগ; schema, grants, RLS policies যাচাই।
- [ ] `SITE_URL`-এ সঠিক production domain; Supabase Auth Site URL/Redirect URLs সঠিক।
- [ ] প্রথম admin Auth account তৈরি, UUID `admin_users`-এ যোগ, admin login পরীক্ষা।
- [ ] Public signup বন্ধ কি না সিদ্ধান্ত; admin password/MFA সুরক্ষিত।
- [ ] bKash/Nagad receiver account type নিশ্চিত; বর্তমান code-এর accountType placeholder ঠিক করা।
- [ ] `DRIVE_FOLDER_URL`, `DRIVE_EBOOK_URL`, `DRIVE_FLASHCARDS_URL` server-side secrets হিসেবে সেট; কোনো Drive URL frontend build-এ নেই।
- [ ] চারটি Edge Function deploy এবং logs পরীক্ষা।
- [ ] আলাদা staging-এ প্রকৃত payment, manual verification, claim-link expiry/revocation ও non-admin RLS পরীক্ষা সম্পন্ন।
- [ ] GitHub Pages build/publish workflow বা source configured; frontend variables build-time-এ সরবরাহ।
- [ ] Public `create-order` endpoint-এ rate limiting/CAPTCHA বা উপযুক্ত abuse monitoring দরকার কি না launch-এর আগে সিদ্ধান্ত। CORS-কে spam protection ধরে নেবেন না।
- [ ] Customer privacy, support/contact process, refund policy ও manual delivery response time নির্ধারণ।

## এখনো আপনার কাছ থেকে/আপনার হাতে configure হওয়া বাকি

1. Supabase project ও project ref; database password শুধু CLI prompt-এ।
2. Public project URL ও anon/publishable key local এবং production build environment-এ।
3. Production GitHub Pages URL/domain; `SITE_URL`, Auth Site URL/Redirect URLs, Pages build/publish workflow.
4. Admin email/password, UUID membership, MFA.
5. bKash/Nagad account type/receiver ownership confirmation.
6. Ebook, flashcards ও folder Drive URLs; server-side secrets.
7. Edge Functions deploy.
8. Staging project-এ actual controlled test payment, RLS test, claim-link download/delivery verification.
9. Public order endpoint abuse protection/monitoring এবং privacy/refund/support policies.

**এই নথি তৈরি করতে কোনো Supabase project পরিবর্তন, migration, secret update, function deploy, Storage upload, GitHub configuration, commit বা push করা হয়নি। পরবর্তী deployment/configuration পদক্ষেপ আপনার স্পষ্ট অনুমোদন না পাওয়া পর্যন্ত করা হবে না।**
