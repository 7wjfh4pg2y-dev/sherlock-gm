-- db/008_map_stroke_label.sql
-- Adds a label field to map_strokes so players can annotate pins.
alter table public.map_strokes
  add column if not exists label text not null default '';
