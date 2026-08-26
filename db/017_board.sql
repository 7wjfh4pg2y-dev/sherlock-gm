-- ── Deduction board ──
-- A shared pin-board per case: clue cards the team has pulled out of the Clues
-- tab, free-text notes, and links ("string") drawn between them. Separate from
-- map_strokes: that pins geometry to a map image, this is an abstract surface
-- for arranging what the team thinks it knows.
--
-- Coordinates are absolute px in a FIXED logical board (see BOARD_W/BOARD_H in
-- src/components/boardInlay.ts), not normalised to any image — so an
-- arrangement looks the same on a phone and a laptop. The viewport pans and
-- zooms over that space.
--
-- Ownership mirrors map_strokes: each row carries its author's name + colour.
-- Anyone may MOVE a card (rearranging together is the point of the board), but
-- only the author or the GM may DELETE one — enforced in the client, as
-- everywhere else in this app. RLS is open like the rest of the schema.

create table if not exists public.board_items (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases(id) on delete cascade,
  -- 'clue' -> mirrors a revealed clue, body comes from clues.clue_text
  -- 'note'  -> free text the team wrote, body is `text`
  kind         text not null default 'note' check (kind in ('clue', 'note')),
  clue_id      uuid references public.clues(id) on delete cascade,
  text         text not null default '',
  x            double precision not null default 0,
  y            double precision not null default 0,
  player_name  text not null default '',
  player_color text not null default '',
  created_at   timestamptz not null default now(),
  -- A clue card is meaningless without the clue it mirrors.
  constraint board_items_clue_needs_ref check (kind <> 'clue' or clue_id is not null)
);

-- A link between two cards. Cascading on both ends means deleting a card takes
-- its string with it — no dangling links to filter out in the client.
create table if not exists public.board_links (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases(id) on delete cascade,
  from_id      uuid not null references public.board_items(id) on delete cascade,
  to_id        uuid not null references public.board_items(id) on delete cascade,
  player_name  text not null default '',
  player_color text not null default '',
  created_at   timestamptz not null default now(),
  constraint board_links_no_self check (from_id <> to_id)
);

create index if not exists board_items_case_idx on public.board_items(case_id);
create index if not exists board_links_case_idx on public.board_links(case_id);
-- Postgres does not index the referencing side of a foreign key, so without
-- these every board_items delete sequentially scans board_links twice.
create index if not exists board_links_from_idx on public.board_links(from_id);
create index if not exists board_links_to_idx on public.board_links(to_id);
-- One string per pair, whichever end it was drawn from. The client checks for a
-- duplicate before inserting, but two players linking the same pair at the same
-- moment would both pass that check and leave an unremovable double line.
create unique index if not exists board_links_pair_uniq on public.board_links
  (case_id, least(from_id, to_id), greatest(from_id, to_id));

alter table public.board_items enable row level security;
alter table public.board_links enable row level security;

drop policy if exists "board_items anon all" on public.board_items;
create policy "board_items anon all" on public.board_items
  for all using (true) with check (true);

drop policy if exists "board_links anon all" on public.board_links;
create policy "board_links anon all" on public.board_links
  for all using (true) with check (true);

-- Realtime: without both of these the board will not sync between players.
alter table public.board_items replica identity full;
alter table public.board_links replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.board_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.board_links;
  exception when duplicate_object then null;
  end;
end $$;
