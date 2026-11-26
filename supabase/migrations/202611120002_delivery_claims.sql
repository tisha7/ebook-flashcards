create table if not exists public.delivery_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  issued_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  constraint delivery_claims_expiry_after_creation
    check (expires_at > created_at),
  constraint delivery_claims_revocation_actor_requires_timestamp
    check (revoked_by is null or revoked_at is not null)
);

create index if not exists delivery_claims_order_created_at_idx
  on public.delivery_claims (order_id, created_at desc);

create unique index if not exists delivery_claims_one_unrevoked_per_order_idx
  on public.delivery_claims (order_id)
  where revoked_at is null;

alter table public.delivery_claims enable row level security;

revoke all on public.delivery_claims from public, anon, authenticated;
grant all on public.delivery_claims to service_role;
