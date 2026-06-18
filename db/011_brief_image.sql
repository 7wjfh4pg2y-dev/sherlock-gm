-- Add optional image attachment to the case brief.
alter table public.cases
  add column if not exists brief_image_url text;
