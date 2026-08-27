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
import { confirmDelete } from './confirmDelete';
import type { BoardItemRow, BoardLinkRow, ClueRow } from '../data/types';

/** The logical board everyone shares. Cards store absolute px inside it.
 *  Deliberately finite: roughly 16 cards wide by 20 tall, which is generous
 *  for a case's worth of leads, while bounded panning and a zoom floor that
 *  fits the whole thing mean nobody can wander off into empty space. */
const BOARD_W = 4000;
const BOARD_H = 2500;
const CARD_W = 240;
/** Drag further than this (board px) and it counts as a move, not a tap. */
const DRAG_MIN = 4;
/** How far a label tag hangs below its strand, on its own stub of string.
 *  Without the drop the strand runs diagonally behind the tag body instead of
 *  above it, and the tag reads as impaled rather than hung. */
const TAG_DROP = 54;

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
  // Labels are HTML, not SVG <text>: they need wrapping, a parchment tag and
  // the app's fonts, none of which SVG text gives cheaply.
  const labelLayer = h('div', { class: 'board-link-labels' });
  const surface = h('div', { class: 'board-surface' },
    linkLayer as unknown as HTMLElement, labelLayer, cardLayer);
  surface.style.width = `${BOARD_W}px`;
  surface.style.height = `${BOARD_H}px`;

  const viewport = h('div', { class: 'board-viewport' }, surface);
  const empty = h('div', { class: 'board-empty' });
  const toolbar = h('div', { class: 'board-toolbar' });
  const drawer = h('div', { class: 'board-drawer' });
  const element = h('div', { class: 'board-inlay' }, viewport, toolbar, drawer, empty);

  // origin must match .board-surface's transform-origin, or zoom drifts.
  // bounds keeps the board on screen: panning stops at its edges, and zooming
  // out stops once the whole board fits rather than revealing a void around it.
  const pz: PanZoomHandle = attachPanZoom(viewport, surface, {
    min: 0.2, max: 2, origin: 'top-left',
    bounds: { width: BOARD_W, height: BOARD_H },
  });
  // A comfortable reading zoom to start and to reset to; the floor above is
  // whatever fits the board, which is usually further out than this.
  pz.setFitScale(0.5);

  // The zoom floor depends on viewport size, so a rotation or a resized window
  // has to re-clamp — otherwise you can end up below the floor, looking at the
  // board with empty space around it.
  const resizeObs = new ResizeObserver(() => pz.refit());
  resizeObs.observe(viewport);

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
  // What each card was last painted from, so an unchanged card is left alone.
  // refresh() runs on every realtime event, and repainting rebuilds each card's
  // DOM including its tack — wasted work several times a second with four
  // players rearranging.
  const painted = new Map<string, string>();
  // Redrawing the strands is the expensive part (every strand, several SVG
  // nodes each). Coalesce to one per animation frame instead of one per
  // pointermove, which on a 120Hz phone was twice per displayed frame.
  let linkRaf = 0;
  function scheduleLinks(): void {
    if (linkRaf) return;
    linkRaf = requestAnimationFrame(() => { linkRaf = 0; drawLinks(); });
  }

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
    const prev = store.getState().boardItems.find((i) => i.id === id);
    store.set({ boardItems: store.getState().boardItems.map((i) => (i.id === id ? { ...i, x, y } : i)) });
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
      // Restore just this card against CURRENT state — replacing the whole
      // array would silently discard everything other players did while the
      // write was in flight.
      if (prev) {
        store.set({
          boardItems: store.getState().boardItems.map((i) => (i.id === id ? { ...i, x: prev.x, y: prev.y } : i)),
        });
      }
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
    // Removing a card cascades away every string attached to it, and the ✕ sits
    // right where you grab the card to drag it. Too destructive to be one tap.
    const attached = store.getState().boardLinks
      .filter((l) => l.from_id === item.id || l.to_id === item.id).length;
    const what = clueFor(item)?.location_name ?? 'this note';
    const ok = await confirmDelete(
      attached
        ? `Take ${what} off the board? That cuts ${attached} string${attached === 1 ? '' : 's'} too.`
        : `Take ${what} off the board?`,
    );
    if (!ok) return;
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
        case_id: caseId, from_id: fromId, to_id: toId, label: '',
        player_name: me.name, player_color: me.color,
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
      if (!store.getState().boardLinks.some((l) => l.id === link.id)) {
        store.set({ boardLinks: [...store.getState().boardLinks, link] });
      }
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
      if (e.button !== 0) return;   // primary button / touch only
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
      // Clamp with the card's measured height: cards wrap their text, so a
      // long clue is far taller than any constant, and the pan clamp stops at
      // the board edge — anything past it is unreachable at any zoom.
      const cardH = card.offsetHeight || 60;
      const next = {
        x: Math.max(0, Math.min(BOARD_W - CARD_W, p.x - dragDX)),
        y: Math.max(0, Math.min(BOARD_H - cardH, p.y - dragDY)),
      };
      localPos.set(id, next);
      place(card, next);
      scheduleLinks();
    });

    function endDrag(e: PointerEvent): void {
      if (dragId !== id) return;
      e.stopPropagation();
      const next = localPos.get(id);
      const origin = dragOrigin;
      dragId = null;
      dragOrigin = null;
      card.classList.remove('dragging');
      pz.setPanEnabled(!linkMode);
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

  /** A thumbtack in the author's colour: needle, metal collar, domed head with
   *  a highlight. Drawn rather than a flat dot so it reads as pushed IN.
   *  Built as nodes, never innerHTML — player_color is a free-text column, so
   *  interpolating it into markup would be an injection hole. */
  function makeTack(colour: string): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'board-pin');
    svg.setAttribute('viewBox', '0 0 24 28');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '28');

    const el = (tag: string, attrs: Record<string, string>): SVGElement => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };

    svg.append(
      // needle, angled so the head sits above where it bites the board
      el('path', { d: 'M12 15 L13.4 27', stroke: '#6b6b6b', 'stroke-width': '1.6', 'stroke-linecap': 'round', fill: 'none' }),
      el('ellipse', { cx: '12', cy: '14.4', rx: '4.2', ry: '1.9', fill: '#8d8d8d' }),
      el('ellipse', { cx: '12', cy: '9', rx: '8', ry: '7', fill: colour }),
      el('ellipse', { cx: '12', cy: '9', rx: '8', ry: '7', fill: 'none', stroke: 'rgba(20,14,6,0.35)', 'stroke-width': '1' }),
      el('ellipse', { cx: '9.2', cy: '6.4', rx: '2.9', ry: '2.1', fill: 'rgba(255,255,255,0.45)' }),
    );
    return svg;
  }

  /** Everything paintCard reads. Same signature, same pixels — skip the work. */
  function cardSignature(item: BoardItemRow): string {
    const clue = clueFor(item);
    return [
      item.kind, item.player_color, item.text,
      clue?.location_name ?? '', clue?.clue_text ?? '',
      canDelete(item) ? '1' : '0',
    ].join('\u0000');
  }

  function paintCard(card: HTMLElement, item: BoardItemRow): void {
    clear(card);
    const clue = clueFor(item);
    const title = clue ? clue.location_name : 'Note';
    const body = clue ? stripMarkup(clue.clue_text) : item.text;

    const pin = makeTack(item.player_color || '#8c2b20');

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
  // Real string hangs and is spun from fibres, so each strand is a sagging
  // curve drawn three times: a dark under-strand for depth, the coloured body,
  // and a dashed lighter strand over the top whose gaps read as the twist. A
  // fourth, invisible, fat stroke is the click target — a 3px thread is
  // impossible to hit on a phone.
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function strandPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
    const x1 = a.x + CARD_W / 2, y1 = a.y + 30;
    const x2 = b.x + CARD_W / 2, y2 = b.y + 30;
    // Sag grows with span, the way a longer piece of yarn droops further.
    const sag = Math.min(130, Math.hypot(x2 - x1, y2 - y1) * 0.22);
    return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`;
  }

  /** Midpoint of that quadratic, where the label tag hangs. */
  function strandMid(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
    const x1 = a.x + CARD_W / 2, y1 = a.y + 30;
    const x2 = b.x + CARD_W / 2, y2 = b.y + 30;
    const sag = Math.min(130, Math.hypot(x2 - x1, y2 - y1) * 0.22);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 + sag;
    return { x: 0.25 * x1 + 0.5 * cx + 0.25 * x2, y: 0.25 * y1 + 0.5 * cy + 0.25 * y2 };
  }

  function drawLinks(): void {
    const s = store.getState();
    const items = visibleItems();
    const shown = new Set(items.map((i) => i.id));
    const byId = new Map(items.map((i) => [i.id, i] as const));
    clear(linkLayer as unknown as Node);
    clear(labelLayer);

    for (const link of s.boardLinks) {
      if (!shown.has(link.from_id) || !shown.has(link.to_id)) continue;
      const a = posOf(byId.get(link.from_id)!);
      const b = posOf(byId.get(link.to_id)!);
      const d = strandPath(a, b);
      const colour = link.player_color || '#a8451f';

      const strand = (cls: string, stroke: string) => {
        const el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('d', d);
        el.setAttribute('class', cls);
        el.setAttribute('stroke', stroke);
        el.setAttribute('fill', 'none');
        return el;
      };

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'board-strand');
      g.appendChild(strand('board-strand-shadow', 'rgba(20,14,6,0.5)'));
      g.appendChild(strand('board-strand-body', colour));
      // Grooves between the fibres are DARK, not pale: a light twist vanished
      // entirely on a yellow or cream strand. Dark reads on every hue.
      g.appendChild(strand('board-strand-twist', 'rgba(26,18,8,0.55)'));
      // A thin off-centre highlight gives the strand roundness.
      g.appendChild(strand('board-strand-sheen', 'rgba(255,248,230,0.45)'));
      const hit = strand('board-strand-hit', 'transparent');
      hit.addEventListener('click', (e) => { e.stopPropagation(); openLinkEditor(link); });
      g.appendChild(hit);
      linkLayer.appendChild(g);

      // Never trust `label` to exist: if db/018 has not been applied yet the
      // column is absent from select('*'), and a bare .trim() here would throw
      // out of drawLinks -> refresh -> renderBoard and blank the whole tab.
      const label = (link.label ?? '').trim();
      if (label) {
        const m = strandMid(a, b);
        // A short stub of the same wool, so the tag hangs clear of the strand
        // and the strand stays unbroken behind it.
        const stub = document.createElementNS(SVG_NS, 'line');
        stub.setAttribute('x1', String(m.x));
        stub.setAttribute('y1', String(m.y));
        stub.setAttribute('x2', String(m.x));
        stub.setAttribute('y2', String(m.y + TAG_DROP));
        stub.setAttribute('class', 'board-strand-stub');
        stub.setAttribute('stroke', colour);
        g.appendChild(stub);

        const tag = h('div', { class: 'board-link-tag', text: label });
        // Tags ellipsise, so keep the full text reachable on hover.
        tag.setAttribute('title', label);
        tag.style.transform = `translate(${m.x}px, ${m.y + TAG_DROP}px)`;
        tag.addEventListener('click', (e) => { e.stopPropagation(); openLinkEditor(link); });
        labelLayer.appendChild(tag);
      }
    }
  }

  // Tapping a string used to delete it outright — no confirmation, and no way
  // to say WHY two cards are connected. It now opens a small editor instead.
  function openLinkEditor(link: BoardLinkRow): void {
    const { handle, body } = openTitledModal('This connection', { contentClass: 'board-note-modal' });
    const field = h('input', {
      class: 'gm-input',
      attrs: { type: 'text', maxlength: '40', placeholder: 'e.g. contradicts, same night, both saw the mirror' },
    }) as HTMLInputElement;
    field.value = link.label ?? '';

    const save = h('button', { class: 'btn btn-primary btn-sm', text: 'Save' });
    const cancel = h('button', { class: 'btn btn-secondary btn-sm', text: 'Cancel' });
    const actions = h('div', { class: 'board-note-actions' }, cancel, save);

    // Anyone may label a string, as anyone may move a card; cutting it stays
    // with its author or the GM.
    if (canDelete(link)) {
      const cut = h('button', { class: 'btn btn-danger btn-sm', text: '✂ Cut string' });
      cut.addEventListener('click', () => { handle.close(); void removeLink(link); });
      actions.prepend(cut);
    }

    function submit(): void {
      const next = field.value.trim();
      handle.close();
      if (next !== (link.label ?? '')) void setLinkLabel(link, next);
    }
    save.addEventListener('click', submit);
    cancel.addEventListener('click', () => handle.close());
    field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

    body.append(field, actions);
    field.focus();
    field.select();
  }

  async function setLinkLabel(link: BoardLinkRow, label: string): Promise<void> {
    if (isPending(link.id)) return;
    const before = store.getState().boardLinks;
    store.set({ boardLinks: before.map((l) => (l.id === link.id ? { ...l, label } : l)) });
    try {
      await linkRepo.setLabel(link.id, label);
    } catch {
      store.set({
        boardLinks: store.getState().boardLinks.map((l) => (l.id === link.id ? { ...l, label: link.label ?? '' } : l)),
      });
      toast('Could not save that label.');
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
        painted.set(item.id, cardSignature(item));
      } else if (dragId !== item.id) {
        // Repaint only when something a viewer can see actually changed —
        // refresh() runs on every realtime event, and paintCard rebuilds the
        // card's DOM including its tack.
        const sig = cardSignature(item);
        if (painted.get(item.id) !== sig) {
          paintCard(card, item);
          painted.set(item.id, sig);
        }
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
      painted.delete(id);
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
  resetBtn.addEventListener('click', () => {
    // reset() alone lands on the board's top-left corner, which after any
    // panning is usually empty — it reads as "my board got wiped". Go to the
    // team's actual arrangement instead.
    pz.setFitScale(0.5);
    const items = visibleItems();
    if (!items.length) return;
    const xs = items.map((i) => posOf(i).x), ys = items.map((i) => posOf(i).y);
    const cx = (Math.min(...xs) + Math.max(...xs) + CARD_W) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    centreOn(cx, cy);
  });

  /** Bring a point in board coordinates to the middle of the viewport. */
  function centreOn(bx: number, by: number): void {
    const r = viewport.getBoundingClientRect();
    const t = pz.getTransform();
    pz.panBy(r.width / 2 - (bx * t.scale + t.tx), r.height / 2 - (by * t.scale + t.ty));
  }

  // The toolbar sits on top of the board, so it can cover cards on a small
  // screen. This folds it away to a single handle without losing the board
  // position underneath.
  const tools = h('div', { class: 'board-tools', attrs: { id: 'board-tools' } },
    drawerBtn, noteBtn, linkBtn, zoomOutBtn, zoomInBtn, resetBtn);
  let toolsOpen = true;
  const foldBtn = h('button', {
    class: 'board-fold',
    attrs: {
      type: 'button', title: 'Hide tools', 'aria-label': 'Hide tools',
      'aria-expanded': 'true', 'aria-controls': 'board-tools',
    },
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
  let drawerSig = '';
  function renderDrawer(): void {
    drawer.style.display = drawerOpen ? '' : 'none';
    if (!drawerOpen) { drawerSig = ''; return; }
    const s = store.getState();
    const pinned = new Set(s.boardItems.filter((i) => i.kind === 'clue').map((i) => i.clue_id));
    const available = selectors.revealedClues(s).filter((c) => !pinned.has(c.id));
    // renderDrawer runs on every realtime event; rebuilding an unchanged list
    // would throw away the viewer's scroll position mid-scroll.
    const sig = available.map((c) => c.id).join(',');
    if (sig === drawerSig) return;
    drawerSig = sig;
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
      resizeObs.disconnect();
      pz.detach();
      cardEls.clear();
      localPos.clear();
    },
  };
}
