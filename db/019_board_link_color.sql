-- Per-string colour.
--
-- A string is drawn in its author's player colour by default. This column is an
-- OVERRIDE for one particular string: empty means "use the author's colour", so
-- existing strings keep following their author (including when a player changes
-- colour mid-case, which recolours their cards and strings in bulk), while a
-- deliberately recoloured string keeps the hue it was given.

alter table public.board_links
  add column if not exists color text not null default '';
