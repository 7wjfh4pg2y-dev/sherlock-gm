-- Campaign chronology: each case's position in the box (1 = first mystery).
-- Used to unlock newspapers cumulatively — when playing case N, players see
-- newspapers from every case with ordinal <= N.
alter table public.cases add column if not exists ordinal int not null default 0;
