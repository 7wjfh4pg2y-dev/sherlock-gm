-- Collaborative map markings: freehand marker strokes and location pins drawn
-- by players (and the GM) on the case map, synced in real time.
--
-- Geometry is stored as normalised 0..1 coordinates relative to the map image,
-- so a marking stays pinned to the same spot at any zoom level or screen size.
--   kind = 'stroke' -> `points` is the polyline ([{x,y}, ...])
--   kind = 'pin'    -> `points` holds a single {x,y}
-- Ownership: a marking carries the author's name + colour. Only the author (or
-- the GM) may erase it — enforced in the client (RLS here is open like the rest
-- of the app's tables).
create table if not exists public.map_strokes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  player_name text not null default '',
  player_color text not null default '',
  kind text not null default 'stroke',
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.map_strokes enable row level security;
create policy "map_strokes anon all" on public.map_strokes
  for all using (true) with check (true);
alter table public.map_strokes replica identity full;
alter publication supabase_realtime add table public.map_strokes;
