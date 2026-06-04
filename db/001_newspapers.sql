-- Newspapers: per-case scanned pages, always visible to players.
create table if not exists public.newspapers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null default '',
  image_url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Open RLS to match the other tables (anon read/insert/update/delete).
alter table public.newspapers enable row level security;
create policy "newspapers anon all" on public.newspapers
  for all using (true) with check (true);

-- Realtime: emit changes, and carry case_id on DELETE (per the project's
-- REPLICA IDENTITY FULL convention) so the per-case channel filter keeps deletes.
alter table public.newspapers replica identity full;
alter publication supabase_realtime add table public.newspapers;
