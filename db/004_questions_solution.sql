-- End-of-case Questions + Sherlock's Solution.
-- Questions are authored by the GM (prompt + official answer + point value).
-- The official answer is hidden from players until the GM reveals it (per
-- question). Players fill in ONE shared team answer per question. Sherlock's
-- solution is one narrative per case, revealed by the GM when ready.

-- 1. GM-authored questions. Players never fetch the `answer` column for an
--    unrevealed question (the client query omits it), mirroring how unrevealed
--    clue text is kept off the wire.
create table if not exists public.case_questions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  prompt text not null default '',
  answer text not null default '',
  points int not null default 0,
  position int not null default 0,
  revealed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.case_questions enable row level security;
create policy "case_questions anon all" on public.case_questions
  for all using (true) with check (true);
alter table public.case_questions replica identity full;
alter publication supabase_realtime add table public.case_questions;

-- 2. The team's single collective answer per question (shared answer sheet).
--    One row per question; any player may upsert it.
create table if not exists public.question_answers (
  question_id uuid primary key references public.case_questions(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  content text not null default '',
  updated_by text not null default '',
  updated_color text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.question_answers enable row level security;
create policy "question_answers anon all" on public.question_answers
  for all using (true) with check (true);
alter table public.question_answers replica identity full;
alter publication supabase_realtime add table public.question_answers;

-- 3. Sherlock's solution: one row per case, in its own table so the player query
--    can filter `revealed = true` and the content never reaches the client
--    before the GM reveals it (same security model as clues/questions).
create table if not exists public.case_solutions (
  case_id uuid primary key references public.cases(id) on delete cascade,
  content text not null default '',
  revealed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.case_solutions enable row level security;
create policy "case_solutions anon all" on public.case_solutions
  for all using (true) with check (true);
alter table public.case_solutions replica identity full;
alter publication supabase_realtime add table public.case_solutions;
