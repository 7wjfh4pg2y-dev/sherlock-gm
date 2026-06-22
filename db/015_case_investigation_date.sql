-- Add an optional in-world date for when the investigation takes place.
alter table public.cases
  add column if not exists investigation_date date;
