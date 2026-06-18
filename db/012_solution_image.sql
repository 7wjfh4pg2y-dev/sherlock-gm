-- Add optional image attachment to the case solution.
alter table public.case_solutions
  add column if not exists image_url text;
