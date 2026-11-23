-- WebAuthn verifies identity before the edge function requests a gallery session.
-- These tables are accessible only to the server's service role.
create table public.gallery_passkeys (
  credential_id text primary key,
  identity uuid unique not null default gen_random_uuid(),
  public_key text not null,
  sign_count bigint not null default 0,
  label text not null check(length(label) between 1 and 48)
);
create table public.gallery_ceremonies (
  id uuid primary key,
  expires_at timestamptz not null
);
create index gallery_ceremonies_expiry on public.gallery_ceremonies(expires_at);
alter table public.gallery_passkeys enable row level security;
alter table public.gallery_ceremonies enable row level security;
revoke all on public.gallery_passkeys, public.gallery_ceremonies from public, anon, authenticated;
grant select,insert,update on public.gallery_passkeys to service_role;
grant select,insert,delete on public.gallery_ceremonies to service_role;
