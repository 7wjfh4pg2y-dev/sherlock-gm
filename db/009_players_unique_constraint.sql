-- Ensure the players table has a unique constraint on (case_id, player_name).
-- Required for the upsert in players.join() to work correctly.
-- If the constraint already exists this is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and contype = 'u'
      and conname = 'players_case_id_player_name_key'
  ) then
    alter table public.players
      add constraint players_case_id_player_name_key unique (case_id, player_name);
  end if;
end $$;
