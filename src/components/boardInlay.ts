// ── Deduction board ──
// A shared pin-board per case: clue cards the team pulled out of the Clues tab,
// free notes, and string drawn between them. Used by both the GM and player
// screens.
//
// Three decisions worth knowing before editing this file:
//
// 1. DOM cards + an SVG link layer, NOT a canvas. Cards carry wrapping text, and
//    CSS-scaling a large canvas blows up iOS Safari's texture budget (the bug
//    that used to crash the map). Both problems vanish with DOM + SVG.
// 2. The element is built ONCE and patched in place. Every optimistic drag
//    writes to the store, which fires a full screen render; rebuilding here on
//    each of those would stutter and drop the gesture mid-drag.
// 3. Coordinates are absolute px inside a fixed logical board (BOARD_W/H), not
//    normalised to any image, so an arrangement reads identically on a phone and
//    a laptop. attachPanZoom moves the viewport over that space.
//
// Ownership: anyone may MOVE a card — rearranging together is the point — but
// only the author or the GM may DELETE one.

import { h, clear } from '../util/dom';
import { attachPanZoom, type PanZoomHandle } from '../util/panZoom';
import { store, selectors } from '../state/store';
import { boardItems as itemRepo, boardLinks as linkRepo } from '../data/supabase';
import { stripMarkup } from '../util/richText';
import { toast } from './toast';
import { openTitledModal } from './modal';
import type { BoardItemRow, BoardLinkRow, ClueRow } from '../data/types';

/** The logical board everyone shares. Cards store absolute px inside it. */
const BOARD_W = 4000;
const BOARD_H = 2500;
const CARD_W = 240;
/** Drag further than this (board px) and it counts as a move, not a tap. */
const DRAG_MIN = 4;

export interface BoardInlayHandle {
  element: HTMLElement;
  /** Re-read the store and patch the board in place. Never rebuilds. */
  refresh(): void;
  detach(): void;
}

export interface BoardInlayOptions {
  isGM: boolean;
  author: { name: string; color: string };
}

export function buildBoardInlay(opts: BoardInlayOptions): BoardInlayHandle {
  const { isGM } = opts;

  // Live author: a player can change colour mid-case, so read it fresh.
  function currentAuthor(): { name: string; color: string } {
    if (isGM) return opts.author;
    return store.getState().identity ?? opts.author;
  }

  // ── Structure ──
  const linkLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  linkLayer.setAttribute('class', 'board-links');
  linkLayer.setAttribute('width', String(BOARD_W));
  linkLayer.setAttribute('height', String(BOARD_H));
  linkLayer.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);

  const cardLayer = h('div', { class: 'board-cards' });
  const surface = h('div', { class: 'board-surface' }, linkLayer as unknown as HTMLElement, cardLayer);
  surface.style.width = `${BOARD_W}px`;
  surface.style.height = `${BOARD_H}px`;

  const viewport = h('div', { class: 'board-viewport' }, surface);
  const empty = h('div', { class: 'board-empty' });
  const toolbar = h('div', { class: 'board-toolbar' });
  const drawer = h('div', { class: 'board-drawer' });
  const element = h('div', { class: 'board-inlay' }, viewport, toolbar, drawer, empty);

  // origin must match .board-surface's transform-origin, or zoom drifts.
  const pz: PanZoomHandle = attachPanZoom(viewport, surface, { min: 0.2, max: 2, origin: 'top-left' });
  pz.setFitScale(0.5);

  // ── Live interaction state (never in the store — this is view-local) ──
  let dragId: string | null = null;
  let dragDX = 0, dragDY = 0;
  let dragOrigin: { x: number; y: number } | null = null;
  let linkMode = false;
  let linkFrom: string | null = null;
  let drawerOpen = false;
  // Positions we are mid-drag on, so realtime echoes can't yank them away.
  const localPos = new Map<string, { x: number; y: number }>();
  // Card elements by item id, so refresh() can patch rather than rebuild.
  const cardEls = new Map<string, HTMLElement>();

  // ── Coordinate helpers ──
  function toBoard(clientX: number, clientY: number): { x: number; y: number } {
    const r = viewport.getBoundingClientRect();
    const t = pz.getTransform();
    return {
      x: (clientX - r.left - t.tx) / t.scale,
      y: (clientY - r.top - t.ty) / t.scale,
    };
  }

  /** Centre of what the viewer is currently looking at, in board px. */
  function viewCentre(): { x: number; y: number } {
    const r = viewport.getBoundingClientRect();
    return toBoard(r.left + r.width / 2, r.top + r.height / 2);
  }

  function posOf(item: BoardItemRow): { x: number; y: number } {
    return localPos.get(item.id) ?? { x: item.x, y: item.y };
  }

  /** The row as it is NOW. Card elements outlive the row they were built from
   *  (refresh patches in place), so handlers must never close over one. */
  function rowOf(id: string): BoardItemRow | null {
    return store.getState().boardItems.find((i) => i.id === id) ?? null;
  }

  /** An id the server has never seen — its INSERT is still in flight. */
  function isPending(id: string): boolean {
    return id.startsWith('tmp-');
  }

  function canDelete(row: { player_name: string; player_color: string }): boolean {
    const me = currentAuthor();
    return isGM || (row.player_name === me.name && row.player_color === me.color);
  }

  // ── What the board can show ──
  // A clue card is only shown once its clue is actually revealed; the GM sees
  // every card. Skipped cards take their string with them (drawLinks filters on
  // the same set), so an unrevealed clue can't be inferred from a dangling line.
  //
  // The `revealed` check is deliberate belt-and-braces: a player's store already
  // holds only revealed clues, but relying on that invariant would silently turn
  // into a spoiler leak the day the loader changes.
  function visibleItems(): BoardItemRow[] {
    const s = store.getState();
    const byId = new Map(s.clues.map((c) => [c.id, c] as const));
    return s.boardItems.filter((it) => {
      if (it.kind !== 'clue') return true;
      if (!it.clue_id) return false;
      const clue = byId.get(it.clue_id);
      return !!clue && (isGM || clue.revealed);
    });
  }

  function clueFor(item: BoardItemRow): ClueRow | null {
    if (item.kind !== 'clue' || !item.clue_id) return null;
    return store.getState().clues.find((c) => c.id === item.clue_id) ?? null;
  }

  // ── Mutations (optimistic, mirroring mapInlay) ──
  async function addItem(kind: 'clue' | 'note', at: { x: number; y: number }, clueId?: string, text = ''): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;
    const me = currentAuthor();
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: BoardItemRow = {
      id: tempId, case_id: caseId, kind, clue_id: clueId ?? null, text,
      x: at.x, y: at.y, player_name: me.name, player_color: me.color,
      created_at: new Date().toISOString(),
    };
    store.set({ boardItems: [...store.getState().boardItems, optimistic] });
    try {
      const saved = await itemRepo.create({
        case_id: caseId, kind, clue_id: clueId ?? null, text,
        x: at.x, y: at.y, player_name: me.name, player_color: me.color,
      });
      store.set({ boardItems: store.getState().boardItems.map((i) => (i.id === tempId ? saved : i)) });
    } catch {
      store.set({ boardItems: store.getState().boardItems.filter((i) => i.id !== tempId) });
      toast('Could not add that to the board.');
    }
  }

  async function commitMove(id: string, x: number, y: number): Promise<void> {
    const before = store.getState().boardItems;
    store.set({ boardItems: before.map((i) => (i.id === id ? { ...i, x, y } : i)) });
    // Still being inserted: the create carries its own position, and the row
    // has no server id to update yet.
    if (isPending(id)) { localPos.delete(id); return; }
    try {
      await itemRepo.move(id, x, y);
      // A realtime refetch can land while the write is in flight and replace
      // the optimistic row with the pre-move one. The server now holds the new
      // position, so re-assert it before releasing the local override —
      // otherwise the card visibly snaps back until the next realtime event.
      store.set({ boardItems: store.getState().boardItems.map((i) => (i.id === id ? { ...i, x, y } : i)) });
    } catch {
      store.set({ boardItems: before });
      toast('Could not save that move.');
    } finally {
      // Only clear the override if no NEW gesture has since claimed this card —
      // otherwise a slow request from the previous drag wipes the live one.
      if (dragId !== id) localPos.delete(id);
    }
  }

  async function removeItem(item: BoardItemRow): Promise<void> {
    if (!canDelete(item)) { toast('Only the author or the GM can remove this card.'); return; }
    if (isPending(item.id)) { toast('Still saving that card — try again in a moment.'); return; }
    const before = store.getState();
    // Links cascade server-side; drop them locally too so the string vanishes now.
    store.set({
      boardItems: before.boardItems.filter((i) => i.id !== item.id),
      boardLinks: before.boardLinks.filter((l) => l.from_id !== item.id && l.to_id !== item.id),
    });
    try {
      await itemRepo.remove(item.id);
    } catch {
      store.set({ boardItems: before.boardItems, boardLinks: before.boardLinks });
      toast('Could not remove that card.');
    }
  }

  async function addLink(fromId: string, toId: string): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (!caseId || fromId === toId) return;
    if (isPending(fromId) || isPending(toId)) { toast('Still saving that card — try again in a moment.'); return; }
    const existing = store.getState().boardLinks.find(
      (l) => (l.from_id === fromId && l.to_id === toId) || (l.from_id === toId && l.to_id === fromId),
    );
    if (existing) { toast('Those two are already linked.'); return; }
    const me = currentAuthor();
    try {
      const saved = await linkRepo.create({
        case_id: caseId, from_id: fromId, to_id: toId, player_name: me.name, player_color: me.color,
      });
      store.set({ boardLinks: [...store.getState().boardLinks, saved] });
    } catch {
      toast('Could not draw that link.');
    }
  }

  async function removeLink(link: BoardLinkRow): Promise<void> {
    if (!canDelete(link)) { toast('Only the author or the GM can cut this string.'); return; }
    if (isPending(link.id)) return;
    const before = store.getState().boardLinks;
    store.set({ boardLinks: before.filter((l) => l.id !== link.id) });
    try {
      await linkRepo.remove(link.id);
    } catch {
      store.set({ boardLinks: before });
      toast('Could not cut that string.');
    }
  }

  // ── Card building ──
  // Only the id is captured. The ROW is looked up per gesture: this element
  // outlives many versions of its row, and closing over the build-time one made
  // every drag after the first jump, because the stale x/y was used as the
  // grab offset.
  function buildCard(id: string): HTMLElement {
    const card = h('div', { class: 'board-card' });
    card.dataset['id'] = id;
    card.style.width = `${CARD_W}px`;

    card.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (linkMode) return;         // link mode uses click, not drag
      if (dragId !== null) return;  // a second finger must not hijack the drag
      const row = rowOf(id);
      if (!row) return;
      const p = toBoard(e.clientX, e.clientY);
      const cur = posOf(row);
      dragId = id;
      dragDX = p.x - cur.x;
      dragDY = p.y - cur.y;
      dragOrigin = cur;
      localPos.set(id, cur);
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
      pz.setPanEnabled(false);
    });

    card.addEventListener('pointermove', (e) => {
      if (dragId !== id) return;
      e.stopPropagation();
      const p = toBoard(e.clientX, e.clientY);
      const next = {
        x: Math.max(0, Math.min(BOARD_W - CARD_W, p.x - dragDX)),
        y: Math.max(0, Math.min(BOARD_H - 60, p.y - dragDY)),
      };
      localPos.set(id, next);
      place(card, next);
      drawLinks();
    });

    function endDrag(e: PointerEvent): void {
      if (dragId !== id) return;
      e.stopPropagation();
      const next = localPos.get(id);
      const origin = dragOrigin;
      dragId = null;
      dragOrigin = null;
      card.classList.remove('dragging');
      pz.setPanEnabled(true);
      if (!next) return;
      const moved = origin ? Math.hypot(next.x - origin.x, next.y - origin.y) > DRAG_MIN : true;
      if (moved) void commitMove(id, next.x, next.y);
      else localPos.delete(id);
    }
    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', endDrag);

    card.addEventListener('click', (e) => {
      if (!linkMode) return;
      e.stopPropagation();
      if (linkFrom === null) {
        linkFrom = id;
        card.classList.add('link-source');
      } else if (linkFrom === id) {
        linkFrom = null;
        card.classList.remove('link-source');
      } else {
        void addLink(linkFrom, id);
        cardEls.get(linkFrom)?.classList.remove('link-source');
        linkFrom = null;
        setLinkMode(false);
      }
    });

    return card;
  }

  function paintCard(card: HTMLElement, item: BoardItemRow): void {
    clear(card);
    const clue = clueFor(item);
    const title = clue ? clue.location_name : 'Note';
    const body = clue ? stripMarkup(clue.clue_text) : item.text;

    const pin = h('div', { class: 'board-pin' });
    pin.style.background = item.player_color || '#8c2b20';

    const head = h('div', { class: 'board-card-head' },
      h('span', { class: item.kind === 'clue' ? 'board-card-code' : 'board-card-kind', text: title }),
    );
    if (canDelete(item)) {
      const del = h('button', {
        class: 'board-card-del',
        text: '✕',
        attrs: { type: 'button', title: 'Remove from board', 'aria-label': 'Remove from board' },
      });
      del.addEventListener('pointerdown', (e) => e.stopPropagation());
      del.addEventListener('click', (e) => { e.stopPropagation(); void removeItem(item); });
      head.append(del);
    }

    card.classList.toggle('board-card--note', item.kind === 'note');
    card.append(pin, head, h('div', { class: 'board-card-body', text: body || '…' }));
  }

  function place(card: HTMLElement, p: { x: number; y: number }): void {
    card.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  // ── Link drawing ──
  function drawLinks(): void {
    const s = store.getState();
    const shown = new Set(visibleItems().map((i) => i.id));
    const byId = new Map(visibleItems().map((i) => [i.id, i] as const));
    clear(linkLayer as unknown as Node);
    for (const link of s.boardLinks) {
      if (!shown.has(link.from_id) || !shown.has(link.to_id)) continue;
      const a = posOf(byId.get(link.from_id)!);
      const b = posOf(byId.get(link.to_id)!);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a.x + CARD_W / 2));
      line.setAttribute('y1', String(a.y + 30));
      line.setAttribute('x2', String(b.x + CARD_W / 2));
      line.setAttribute('y2', String(b.y + 30));
      line.setAttribute('class', 'board-link');
      line.setAttribute('stroke', link.player_color || '#a8451f');
      line.addEventListener('click', (e) => { e.stopPropagation(); void removeLink(link); });
      linkLayer.appendChild(line);
    }
  }

  // ── Patch-in-place refresh ──
  function refresh(): void {
    const items = visibleItems();
    const seen = new Set<string>();

    for (const item of items) {
      seen.add(item.id);
      let card = cardEls.get(item.id);
      if (!card) {
        card = buildCard(item.id);
        cardEls.set(item.id, card);
        cardLayer.appendChild(card);
        paintCard(card, item);
      } else if (dragId !== item.id) {
        // Repaint content, but never disturb the card the viewer is holding.
        paintCard(card, item);
      }
      if (dragId !== item.id) place(card, posOf(item));
    }
    for (const [id, el] of cardEls) {
      if (seen.has(id)) continue;
      // Someone else deleted this card, or the GM un-revealed its clue, while
      // it might be under this viewer's finger. Removing the node kills the
      // pointerup that would have released the drag, so unwind it here or the
      // board stays unpannable until the tab is switched.
      if (dragId === id) {
        dragId = null;
        dragOrigin = null;
        pz.setPanEnabled(!linkMode);
      }
      if (linkFrom === id) linkFrom = null;
      el.remove();
      cardEls.delete(id);
      localPos.delete(id);
    }

    drawLinks();
    empty.style.display = items.length ? 'none' : '';
    if (!items.length) {
      clear(empty);
      empty.append(
        h('p', { class: 'board-empty-title', text: 'Nothing pinned yet' }),
        h('p', { class: 'board-empty-sub', text: 'Add a clue from the drawer, or pin a note, then link what connects.' }),
      );
    }
    renderDrawer();
  }

  // ── Toolbar ──
  function setLinkMode(on: boolean): void {
    linkMode = on;
    if (!on && linkFrom) {
      cardEls.get(linkFrom)?.classList.remove('link-source');
      linkFrom = null;
    }
    element.classList.toggle('linking', on);
    linkBtn.classList.toggle('active', on);
    pz.setPanEnabled(!on);
  }

  const drawerBtn = h('button', { class: 'board-btn', attrs: { type: 'button' } },
    h('span', { text: '📌' }), h('span', { text: 'Add clue' }));
  drawerBtn.addEventListener('click', () => {
    drawerOpen = !drawerOpen;
    drawerBtn.classList.toggle('active', drawerOpen);
    renderDrawer();
  });

  // The app's own modal rather than window.prompt: a browser prompt looks
  // nothing like the rest of the UI, and is a silent no-op in a standalone
  // home-screen web app, which would leave Note quietly dead on a phone.
  function askForNote(): void {
    const { handle, body } = openTitledModal('Pin a note', { contentClass: 'board-note-modal' });
    // gm-input is the app's real field style (paper ground, sepia focus) —
    // the one the GM's clue and briefing textareas use.
    const field = h('textarea', {
      class: 'gm-input board-note-field',
      attrs: { rows: '4', placeholder: 'What have you worked out?' },
    }) as HTMLTextAreaElement;
    const pin = h('button', { class: 'btn btn-primary btn-sm', text: 'Pin it' });
    const cancel = h('button', { class: 'btn btn-secondary btn-sm', text: 'Cancel' });

    function submit(): void {
      const text = field.value.trim();
      if (!text) { field.focus(); return; }
      handle.close();
      const c = viewCentre();
      void addItem('note', { x: c.x - CARD_W / 2, y: c.y - 40 }, undefined, text);
    }
    pin.addEventListener('click', submit);
    cancel.addEventListener('click', () => handle.close());
    // Enter submits, Shift+Enter keeps writing.
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    body.append(field, h('div', { class: 'board-note-actions' }, cancel, pin));
    field.focus();
  }

  const noteBtn = h('button', { class: 'board-btn', attrs: { type: 'button' } },
    h('span', { text: '📝' }), h('span', { text: 'Note' }));
  noteBtn.addEventListener('click', askForNote);

  const linkBtn = h('button', { class: 'board-btn', attrs: { type: 'button' } },
    h('span', { text: '🧵' }), h('span', { text: 'Link' }));
  linkBtn.addEventListener('click', () => setLinkMode(!linkMode));

  const zoomOutBtn = h('button', {
    class: 'board-btn board-btn--icon', text: '\u2212',
    attrs: { type: 'button', title: 'Zoom out', 'aria-label': 'Zoom out' },
  });
  zoomOutBtn.addEventListener('click', () => pz.zoomOut());

  const zoomInBtn = h('button', {
    class: 'board-btn board-btn--icon', text: '+',
    attrs: { type: 'button', title: 'Zoom in', 'aria-label': 'Zoom in' },
  });
  zoomInBtn.addEventListener('click', () => pz.zoomIn());

  const resetBtn = h('button', {
    class: 'board-btn board-btn--icon', text: '\u27F2',
    attrs: { type: 'button', title: 'Reset view', 'aria-label': 'Reset view' },
  });
  resetBtn.addEventListener('click', () => { pz.reset(); pz.setFitScale(0.5); });

  // The toolbar sits on top of the board, so it can cover cards on a small
  // screen. This folds it away to a single handle without losing the board
  // position underneath.
  const tools = h('div', { class: 'board-tools' }, drawerBtn, noteBtn, linkBtn, zoomOutBtn, zoomInBtn, resetBtn);
  let toolsOpen = true;
  const foldBtn = h('button', {
    class: 'board-fold',
    attrs: { type: 'button', title: 'Hide tools', 'aria-label': 'Hide tools', 'aria-expanded': 'true' },
  });

  function setToolsOpen(open: boolean): void {
    toolsOpen = open;
    tools.hidden = !open;
    foldBtn.textContent = open ? '\u00AB' : '\u00BB';
    foldBtn.title = open ? 'Hide tools' : 'Show tools';
    foldBtn.setAttribute('aria-label', foldBtn.title);
    foldBtn.setAttribute('aria-expanded', String(open));
    element.classList.toggle('tools-folded', !open);
    // Folding away shouldn't leave a mode running that the viewer can no
    // longer see or turn off.
    if (!open) {
      if (drawerOpen) { drawerOpen = false; drawerBtn.classList.remove('active'); renderDrawer(); }
      if (linkMode) setLinkMode(false);
    }
  }
  foldBtn.addEventListener('click', () => setToolsOpen(!toolsOpen));

  toolbar.append(tools, foldBtn);
  setToolsOpen(true);

  // ── Clue drawer: revealed clues not yet on the board ──
  function renderDrawer(): void {
    drawer.style.display = drawerOpen ? '' : 'none';
    if (!drawerOpen) return;
    const s = store.getState();
    const pinned = new Set(s.boardItems.filter((i) => i.kind === 'clue').map((i) => i.clue_id));
    const available = selectors.revealedClues(s).filter((c) => !pinned.has(c.id));
    clear(drawer);
    drawer.append(h('div', { class: 'board-drawer-title', text: available.length ? 'Pin a clue' : 'Every revealed clue is already on the board' }));
    if (!available.length) return;
    const list = h('div', { class: 'board-drawer-list' });
    for (const clue of available) {
      const row = h('button', { class: 'board-drawer-item', attrs: { type: 'button' } },
        h('span', { class: 'board-drawer-code', text: clue.location_name }),
        h('span', { class: 'board-drawer-text', text: stripMarkup(clue.clue_text).slice(0, 70) }),
      );
      row.addEventListener('click', () => {
        const c = viewCentre();
        // Scatter slightly so several pins in a row don't stack exactly.
        const jitter = () => (Math.random() - 0.5) * 90;
        void addItem('clue', { x: c.x - CARD_W / 2 + jitter(), y: c.y - 40 + jitter() }, clue.id);
        drawerOpen = false;
        drawerBtn.classList.remove('active');
        renderDrawer();
      });
      list.append(row);
    }
    drawer.append(list);
  }

  // Clicking empty board clears a half-made link.
  viewport.addEventListener('click', () => { if (linkMode && linkFrom) setLinkMode(false); });

  refresh();

  return {
    element,
    refresh,
    detach() {
      pz.detach();
      cardEls.clear();
      localPos.clear();
    },
  };
}
