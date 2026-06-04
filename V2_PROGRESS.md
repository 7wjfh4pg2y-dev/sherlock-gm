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
- [x] **S2b — Shared components: directory + map viewer.** Done:
  `src/data/directory.ts` (fetch+cache `directory.json`, per-case overrides via
  storage, `loadDirectory`/`categories`/`search`/add/update/remove),
  `src/components/directory.ts` (search + category filter modal; GM add/edit/
  remove inline form), `src/components/mapViewer.ts` (fullscreen image overlay,
  click-to-zoom, Esc/backdrop close). CSS appended to `components.css`. Added
  `src/vite-env.d.ts` for `import.meta.env` types.
  NOTE: map viewer is a simple zoom/pan image (dropped v1's canvas renderer).
  `loadDirectory(caseId)` must be called when a case opens (wire in S3/S4).
- [x] **S3 — Player module** (part 4). Done: `src/player/join.ts`
  (`joinCase(name, caseId)` — resolves case, kick-check, upsert player, seeds
  store, wires `subscribeToCase` → store + presence; `leaveCase()` tears down),
  `src/player/screen.ts` (`createPlayerScreen()` — reactive: subscribes to store,
  renders clue feed + briefing + chrome + the shared notebook; My Notes/Team
  Notes tabs with composer + inline edit/share/delete; clue expand via modal /
  map viewer for images). Added repo methods: `cases.get`, `maps.get`,
  `players.join`/`kickedState`, `clues.listRevealed`, presence
  (`trackPresence`/`watchPresence`), and `noteEditor` in notebook.
  Typechecks + builds clean. NOT yet imported by main.ts (wired in S5).
  Player-screen layout CSS is intentionally deferred to S5.
- [x] **S4 — GM module** (part 3). Done: `src/gm/auth.ts` (localStorage
  session-only password: attemptLogin / gmLogout / resetGMPassword),
  `src/gm/loginScreen.ts` (GM login form; sets store.role='gm' on success),
  `src/gm/load.ts` (loadGMCase / loadGMMaps / loadGMRightPanel / loadGMClues
  — fetch + store.set, called by realtime handlers),
  `src/gm/screen.ts` (full reactive GM screen: case select+CRUD, briefing
  edit inline, clue grid with reveal/hide/edit/delete + add clue modal
  (text or image upload), player panel with presence dots + kick/unkick/delete,
  maps library modal with attach/detach + upload/rename/delete, GM notebook
  modal with Shared + per-player dynamic tabs using createNotebook + noteCard
  delete actions). Typechecks clean. NOT yet wired by main.ts (S5).
- [x] **S5 — Styles + full wiring** (part 6). Done: `src/styles/layout.css`
  (base/grain, landing, GM login, form inputs, GM screen layout, clue grid,
  briefing, player panel rows, maps grid, player screen grid layout, responsive
  breakpoint); `index.css` now imports tokens → layout → components.
  `src/landing.ts` (two-door landing, onJoin callback), `src/gm/loginScreen.ts`
  (already in S4), `src/player/joinScreen.ts` (name + case-code form; resolves
  full-UUID or 8-char-prefix codes; `?case=` deep-link prefills + locks code),
  `src/main.ts` (router: one #app mount, reacts to store.role + local wantJoin;
  mounts landing / join / gm-login / gm / player; tears down prev screen's
  realtime via destroy()). Builds + typechecks clean. Verified in jsdom (esbuild
  IIFE bundle): landing→GM-login→GM-screen and landing→join + `?case=` deep-link
  all mount correctly with the right controls.
- [x] **S6 — Swap + verify (shipped live-first).** Sandbox can't open a browser
  or reach Supabase, so the live GM↔player data flow couldn't be driven here.
  Decision (user): go live-first rather than block on a preview. Fast-forwarded
  `claude/v2-rebuild` → `main` (clean, no conflicts), pushed; Pages workflow ran
  green (build + deploy). Root v1 `app.js`/`style.css`/`index.html` replaced by
  the v2 build; `legacy/` deleted. User confirmed the live site works as far as
  tested (GM login/case/clue reveal, player join, notes, map). v1 history remains
  in git if ever needed.

## Operational notes (GitHub Pages)

- **Pages Source MUST be "GitHub Actions"** (Settings → Pages → Build and
  deployment → Source). It was originally "Deploy from a branch" (v1 served raw
  `index.html`/`app.js` from `main`). After the v2 swap that stale branch deploy
  kept being served — the site showed a blank/white page because v2's root
  `index.html` references built `assets/…` that don't exist in the repo source.
  Fix: set Source = GitHub Actions, then run the `deploy.yml` workflow (push to
  main or manual dispatch) so the built `dist/` becomes the live deployment.
  Do NOT re-enable the legacy "pages build and deployment" (Jekyll) workflow.

## Operational notes (Supabase)

- **REPLICA IDENTITY FULL** is set on `clues`, `notes`, `players`, `cases` (run
  in the SQL editor). Required so realtime DELETE events carry `case_id` — the
  per-case channel filter (`case_id=eq.X`) drops deletes otherwise, and records
  would linger on other clients. The acting client also refreshes its own store
  slice after each delete (belt-and-suspenders). If a fresh Supabase project is
  ever used, re-run the four `ALTER TABLE … REPLICA IDENTITY FULL;` statements.
- **`newspapers` table** must exist (run `db/001_newspapers.sql` in the SQL
  editor). Per-case scanned newspaper pages, always visible to players (no
  reveal flag — handed out at case start in the physical game). Open RLS +
  REPLICA IDENTITY FULL + added to the `supabase_realtime` publication, same as
  the other tables. Without it, the GM "📰 Newspaper" upload and the player
  reader will error.

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

**SHIPPED.** All six segments complete; v2 is live on GitHub Pages from `main`.
`legacy/` removed. The rebuild is done.

Architecture recap (the whole point of v2): mutations only ever *write* to
Supabase; realtime (`subscribeToCase` in `src/data/supabase.ts`) is the *only*
thing that calls `store.set`; components `store.subscribe` and re-render. No
second copy of truth. If a sync bug appears, it's in one of three places: the
realtime handlers in `src/data/supabase.ts`, or the `store.subscribe` render
paths in `src/gm/screen.ts` / `src/player/screen.ts`.
