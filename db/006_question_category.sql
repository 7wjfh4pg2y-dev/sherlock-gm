-- Group questions into the two types the rulebook uses on the Questions page:
--   'main'       = the central-mystery questions scored against Holmes
--   'additional' = secondary "other questions" about side leads/details
-- Defaults to 'main' so existing rows keep their place.

alter table public.case_questions
  add column if not exists category text not null default 'main';
