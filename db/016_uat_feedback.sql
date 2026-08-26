-- Playtest feedback submitted from /uat.html.
--
-- Testers may INSERT only. There is deliberately no SELECT policy, so one
-- tester cannot read another's answers through the public API — read the
-- results in the Supabase dashboard (Table Editor), which runs as the service
-- role and bypasses row-level security.
--
-- `raw` holds the whole submission as readable text, so the table can be
-- skimmed without unpacking the JSON; `payload` keeps the structured version
-- (which checks went unconfirmed, notes per round, answers).

create table if not exists public.uat_feedback (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  tester       text,
  tester_role  text,
  device       text,
  minutes      text,
  checks_done  int,
  checks_total int,
  payload      jsonb,
  raw          text
);

alter table public.uat_feedback enable row level security;

drop policy if exists "anyone may submit playtest feedback" on public.uat_feedback;
create policy "anyone may submit playtest feedback"
  on public.uat_feedback for insert to anon with check (true);
