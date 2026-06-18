-- ── Server-side GM password ──
-- The GM password hash lives in a table the anon client can neither read nor
-- write (RLS enabled, no policies). Verification happens inside a SECURITY
-- DEFINER function that returns only a boolean — the hash never leaves the
-- database. This is the security boundary the old per-device localStorage
-- password was not: previously any visitor could "set" a GM password on their
-- own browser and walk in. Now only someone who knows the real password (set
-- here, in the dashboard) can pass the gate.

create extension if not exists pgcrypto;

-- Singleton table: one row, enforced by a boolean primary key fixed to true.
create table if not exists public.gm_auth (
  id boolean primary key default true,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint gm_auth_singleton check (id)
);

-- Lock it down. RLS on + no policies = anon/authenticated get zero rows and no
-- writes. Also revoke table grants for defence in depth; the verifier below
-- runs as the table owner and so still sees the row.
alter table public.gm_auth enable row level security;
revoke all on table public.gm_auth from anon, authenticated;

-- Verify a candidate password against the stored bcrypt hash. SECURITY DEFINER
-- so it can read gm_auth despite RLS; returns only true/false, never the hash.
create or replace function public.verify_gm_password(candidate text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.gm_auth
    where password_hash = crypt(candidate, password_hash)
  );
$$;

-- Only allow calling the verifier — nothing else is exposed.
revoke all on function public.verify_gm_password(text) from public;
grant execute on function public.verify_gm_password(text) to anon, authenticated;

-- ── SET YOUR GM PASSWORD (run once, with your own password) ──
-- Replace 'change-me' below with the real password, then run just this insert:
--
-- insert into public.gm_auth (id, password_hash)
-- values (true, crypt('change-me', gen_salt('bf')))
-- on conflict (id) do update
--   set password_hash = excluded.password_hash, updated_at = now();
--
-- To CHANGE the password later, run the same statement with the new value.
-- There is no in-app reset, which is the point: only someone with Supabase
-- dashboard access (you) can change it.
