-- The Final Reckoning: a team score for each case, shown beside Sherlock's
-- solution. The GM tallies the team's points (typically out of Holmes' classic
-- 100) while grading their answers, then reveals it once the case is done.
-- `score` is nullable (null = not yet tallied); `score_revealed` gates it to
-- players independently of the solution narrative reveal.
alter table public.case_solutions
  add column if not exists score int,
  add column if not exists score_revealed boolean not null default false;
