-- Newspapers become a shared, case-independent library (like maps). Instead of
-- uploading a paper per case, the GM dumps PDFs/images into one library and
-- enables each for any number of relevant cases via a join table.

-- 1. Join table: which library papers are enabled for which case.
create table if not exists public.case_newspapers (
  case_id uuid not null references public.cases(id) on delete cascade,
  newspaper_id uuid not null references public.newspapers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, newspaper_id)
);

-- Open RLS to match the other tables (anon read/insert/update/delete).
alter table public.case_newspapers enable row level security;
create policy "case_newspapers anon all" on public.case_newspapers
  for all using (true) with check (true);

-- Realtime: emit changes; carry both keys on DELETE so the per-case channel
-- filter keeps deletes (REPLICA IDENTITY FULL convention).
alter table public.case_newspapers replica identity full;
alter publication supabase_realtime add table public.case_newspapers;

-- 2. Migrate existing per-case papers into the join table so nothing is lost:
--    every paper stays enabled for the case it currently belongs to.
insert into public.case_newspapers (case_id, newspaper_id)
  select case_id, id from public.newspapers
  on conflict do nothing;

-- 3. Drop the per-case ownership column — papers are now library-global.
alter table public.newspapers drop column if exists case_id;
