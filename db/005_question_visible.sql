-- Add a separate visibility flag to case_questions.
-- `visible`  = GM has shown the question prompt+points to players (reveal #1)
-- `revealed` = GM has revealed the official answer to players (reveal #2)
-- Both default false so newly created questions are fully hidden.

alter table public.case_questions
  add column if not exists visible boolean not null default false;
