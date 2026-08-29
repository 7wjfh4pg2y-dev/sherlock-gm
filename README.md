# sherlock-gm

A companion app for *Sherlock Holmes: Consulting Detective*. One Game Master
runs a case; players join from their own phones or laptops and share clues, a
map, newspapers, notes and a deduction board in real time.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build into dist/
```

`.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. It is gitignored;
the anon key is public by design (it ships in the bundle).

Pushing to `main` deploys to GitHub Pages automatically. Open tabs pick up new
builds by themselves — see *Auto-update* below.

## Architecture

Vanilla TypeScript, no framework. Vite builds it; Supabase provides Postgres,
storage and realtime.

- **`src/state/store.ts`** — one observable store. Mutations write to Supabase,
  realtime events call the setters, setters notify subscribers. That loop is the
  whole design: nothing re-renders by being told to imperatively.
- **`src/data/supabase.ts`** — every query lives here, one repo object per table,
  plus `subscribeToCase` (realtime) and presence.
- **`src/util/dom.ts`** — a tiny typed hyperscript. Text goes through
  `textContent`, never `innerHTML`, so the app is XSS-safe by construction.
  Also `educateQuotes`, which fixes wrong-facing quotes at display time only.
- **`src/gm/` / `src/player/`** — the two screens. Both are tabbed, both build
  their panels once and patch them in place.

RLS is open on every table. Permissions (who may reveal a clue, delete a card,
see an unrevealed clue) are enforced in the client. That is a deliberate
trade-off for a game played among friends, not a security boundary.

## Database migrations

`db/*.sql`, numbered in order. **They are not applied automatically** — run each
new one by hand in the Supabase SQL editor. A missing migration usually shows up
as a feature that silently refuses to save.

Supabase's editor warns about "destructive operations" for any `drop`; the ones
here only drop and recreate a policy so the file can be re-run safely.

## Things that will bite you

Each of these was a real bug. They are cheap to reintroduce.

- **`dvh`, not `vh`, for full-height layout.** On mobile `100vh` is the viewport
  with the browser toolbars *hidden*, so it forces the document taller than the
  screen and the whole page scrolls behind fixed chrome. That was the cause of a
  long-running phantom gap under the player notebook.
- **Never CSS-scale a large `<canvas>`.** iOS Safari's texture budget blows up
  and the tab dies. The map keeps its canvas outside the transformed layer and
  redraws in viewport space; the board uses DOM + SVG for the same reason.
- **Guard re-render on a logical handle, not `childElementCount`.** Fullscreen
  reparents an element out of its panel, so a "is it built?" check on child
  count rebuilds it and tears down the fullscreen you just entered.
- **`attachPanZoom`'s `origin` must match the layer's CSS `transform-origin`.**
  The map uses centre, the board top-left. Mismatch makes the point under the
  cursor drift on every zoom step.
- **The CSS `rotate`/`translate` properties compose *after* `transform`.** A
  small `rotate` on an element positioned by `transform: translate(...)` rotates
  the translation itself, throwing it far off at large coordinates. Put position
  and rotation in one `transform`.
- **`[hidden]` loses to `display: flex`/`grid`.** Components that toggle the
  hidden attribute need an explicit `[hidden] { display: none }` rule.
- **Optimistic writes: roll back the row, not the array.** Restoring a whole
  captured array discards everything other players did while the write was in
  flight.
- **Handlers must not close over a row.** Elements outlive the rows they were
  built from; look the row up per gesture or you get stale coordinates.
- **A captured pointer delivers its `click` to the capturing element.** Board
  cards call `setPointerCapture` so a fast drag cannot slide off the card and
  drop it. That also redirects the click, so a listener on anything *inside* a
  card — the clue photograph, say — silently never runs. Hang the behaviour off
  the end of the gesture instead: note on pointerdown what the press started on,
  and act on pointerup if the pointer never travelled `DRAG_MIN`. That framing
  also stops a drag ending over the photo from opening it.

## Auto-update

Each build is stamped with an id written to `dist/version.json`. Open tabs poll
it on focus and every five minutes and reload when it changes, so a deploy
reaches players without anyone hard-refreshing. It will not reload while someone
is typing, and it records the build it is reloading toward so an unreachable
bundle cannot cause a loop.

## Playtesting

`public/uat.html` is a self-contained playtest script, served at `/uat.html`.
Testers pick Player or Game Master and the checklist filters to that role.
Submissions go to the `uat_feedback` table; read them in the Supabase dashboard,
where the `raw` column holds each one as plain text.

## Testing changes

There is no test suite. For anything visual or interactive, drive it in a real
browser before pushing — a throwaway Vite entry that seeds the store and mounts
the component, plus Playwright against it, catches far more than reading the
diff does. Several bugs in this codebase looked correct in review and were only
found by measuring the rendered result.
