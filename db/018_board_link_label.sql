-- Lets a string carry a short note about WHY two cards are connected
-- ("contradicts", "same night", "both saw the mirror") — the reasoning that
-- otherwise only lives in someone's head.
--
-- Anyone may label a string, the same as anyone may move a card; cutting one
-- stays restricted to its author or the GM.

alter table public.board_links
  add column if not exists label text not null default '';
