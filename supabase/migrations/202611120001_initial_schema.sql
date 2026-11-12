create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Admins can view their own membership"
  on public.admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 11 and 16),
  payment_method text not null check (payment_method in ('bkash', 'nagad')),
  sender_mobile text not null check (char_length(sender_mobile) between 11 and 16),
  transaction_id text not null check (char_length(transaction_id) between 6 and 40),
  amount_bdt integer not null default 249 check (amount_bdt = 249),
  status text not null default 'PENDING_VERIFICATION'
    check (status in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'DELIVERED')),
  admin_note text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  delivered_at timestamptz,
  delivery_reference text,
  constraint orders_delivery_requires_verification
    check (status <> 'DELIVERED' or verified_at is not null)
);

create unique index if not exists orders_transaction_id_unique_ci
  on public.orders (lower(btrim(transaction_id)));

create index if not exists orders_created_at_desc_idx
  on public.orders (created_at desc);

create index if not exists orders_status_idx
  on public.orders (status);

alter table public.orders enable row level security;

create policy "Only admins can read orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = (select auth.uid())
    )
  );

revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-files',
  'product-files',
  false,
  52428800,
  array['application/pdf', 'application/zip']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no Storage object policies: private product files are accessed
-- only by an authorized Edge Function that issues a short-lived signed URL.
