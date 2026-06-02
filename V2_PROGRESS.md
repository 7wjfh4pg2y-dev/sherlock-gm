# v2.0 Rebuild — Progress Tracker

> **This file is the resume point.** The build runs across multiple sessions on
> an ephemeral environment. Every segment ends with a commit + push and an update
> here. A fresh session with no memory should be able to read this top-to-bottom
> and continue exactly where the last one stopped.

## Decisions (locked)

- **Tooling:** TypeScript + Vite. Zero-runtime-framework; native ES modules.
- **Staging:** Build on branch `claude/v2-rebuild`. `main` keeps live v1 untouched
  until v2 is verified end-to-end, then swap.
- **Deploy:** GitHub Pages via `.github/workflows/deploy.yml` (builds `dist/` on
  push to `main`). Vite `base: './'` for subpath-safe assets.
- **v1 reference:** old app lives in `legacy/` on this branch. Read it anytime
  (`legacy/app.js`, `legacy/index.html`, `legacy/style.css`). Delete `legacy/` at
  swap time.

## Architecture — 6 parts

1. **State store** — `src/state/store.ts` — one observable object; mutations +
   subscribers. No floating module-scope `let`s.
2. **Supabase layer** — `src/data/` — all DB/storage/realtime calls + typed
   schema. Nothing else imports the raw client.
3. **GM module** — `src/gm/` — case mgmt, clue reveal, players, maps, notebook.
4. **Player module** — `src/player/` — join, clue feed, notebook.
5. **Shared components** — `src/components/` — notebook, modal, confirm-delete,
   toast, directory, map viewer.
6. **Styles** — `src/styles/` — tokens → base → per-module. No inline styles in TS.

Data: `public/directory.json` (2,830 entries, 57 categories) — fetched on demand,
NOT bundled into logic.

## Supabase schema (carried from v1 — do not break)

- `cases` (id, name, description, map_id, created_at)
- `clues` (id, case_id, location_name, clue_text, image_url?, revealed, position, created_at)
- `players` (id, case_id, player_name, player_color, is_kicked, joined_at)
- `notes` (id, case_id, player_name, player_color, content, is_private, created_at)
- `maps` (id, name, url, created_at)
- RLS: anon read/insert/update/delete all `true`. (Known weak; out of scope for
  v2 unless we decide otherwise.)
- Storage bucket: `clues` (also holds maps under `maps/` prefix).
- Supabase URL + anon key are in `legacy/app.js` lines 1-2 — move to `src/data/`.

## Segments

- [x] **S0 — Foundation scaffold.** Branch, Vite+TS config, Pages action, dir
  structure, `public/directory.json` extracted, minimal entry that builds.
- [x] **S1 — Data layer + State store** (parts 2 & 1). Done:
  `src/data/types.ts` (schema + insert + app types), `src/data/supabase.ts`
  (typed repos for cases/clues/players/notes/maps + storage + `subscribeToCase`
  realtime helper; raw client isolated here), `src/data/colors.ts`
  (PLAYER_COLORS + nameToColor, same algo as v1), `src/state/store.ts`
  (observable store + selectors). Typechecks clean.
- [x] **S2a — Shared components: core.** Done: `src/util/dom.ts` (typed
  hyperscript `h()` — XSS-safe by construction, no innerHTML strings; `clear`,
  `replaceChildren`, `formatTime`, `escapeHtml`), `src/components/toast.ts`,
  `src/components/modal.ts` (generic overlay + `openTitledModal`; backdrop/Esc
  close), `src/components/confirmDelete.ts` (promise-based), and the reusable
  `src/components/notebook.ts` (`createNotebook` parchment tabbed UI with
  JS-driven `.active` tabs + `noteCard`/`noteFeed`/`fillFeed`/`noteComposer`
  builders). Styles ported to `src/styles/{tokens,components}.css`.
  NOTE: tab switching is now a click handler + `.active` class (not the v1 CSS
  `:checked` trick) so the GM's dynamic per-player tabs work and re-renders
  don't lose focus/active-tab.
- [ ] **S2b — Shared components: directory + map viewer.** Directory modal
  (search + category filter over `public/directory.json`, GM add/remove/edit,
  per-case overrides via `storage.{load,save}DirectoryOverrides`), map viewer
  (fullscreen image modal). See `legacy/app.js` directory fns (~lines 58-260)
  and the canvas map renderer (~line 750).
- [ ] **S3 — Player module** (part 4). join flow + identity, clue feed, notebook
  wired to store + realtime.
- [ ] **S4 — GM module** (part 3). login, case CRUD, clue add/reveal/hide/edit,
  player mgmt, maps library + attach, notebook (all/per-player tabs).
- [ ] **S5 — Styles + full wiring** (part 6). Port Victorian CSS into structured
  files; assemble `main.ts` router (landing → GM / player); index.html shells.
- [ ] **S6 — Verify + swap.** End-to-end check (GM creates case, player joins,
  clue reveal, notes private+shared sync, map attach). Then swap to `main`,
  delete `legacy/`, confirm Pages deploy.

## Things v1 got wrong — must NOT recreate

- Two copies of truth (manual reload + realtime). v2: realtime is the only thing
  that updates the store; mutations just write.
- Private notes in localStorage (GM couldn't see). v2: all notes in DB.
- Map feature orphaned (`map_id` never written). v2: attach wired from the start.
- Stringly-typed DOM + inline styles + copy-pasted render logic. v2: typed render
  helpers, classes only, shared notebook component used by both sides.

## Things v1 got right — keep

- Static SPA, Supabase backend + Realtime + storage, CSS radio-tab trick,
  Victorian parchment aesthetic.

## Current status

**S2a complete.** Core shared components + the reusable notebook build &
typecheck clean. Next: **S2b — directory modal + map viewer**, then S3
(player module). Components are pure DOM builders (not yet imported by
`main.ts`, so the JS bundle is still tiny — they get wired in S3/S4).
