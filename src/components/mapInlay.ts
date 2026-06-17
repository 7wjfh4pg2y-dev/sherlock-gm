// ── Collaborative map inlay ──
// The case map with pan/zoom plus shared markings: freehand marker strokes and
// location pins. Markings are stored in normalised (0..1) image coordinates so
// they stay pinned at any zoom/screen size, synced via the store (which realtime
// keeps fresh). Each marking carries its author; only the author — or the GM —
// may erase it. Used by both the GM and player map tabs.

import { h, clear } from '../util/dom';
import { attachPanZoom } from '../util/panZoom';
import { store } from '../state/store';
import { mapStrokes as strokeRepo } from '../data/supabase';
import { openMapViewer } from './mapViewer';
import { toast } from './toast';
import type { MapRow, MapStrokeRow, MapStrokePoint } from '../data/types';

type Tool = 'pan' | 'draw' | 'pin' | 'erase';

export interface MapInlayHandle {
  element: HTMLElement;
  detach(): void;
}

export interface MapAuthor {
  name: string;
  color: string;
}

// How close (in normalised units) a click must be to erase a marking.
const ERASE_HIT = 0.025;

export function buildMapInlay(opts: { map: MapRow; isGM: boolean; author: MapAuthor }): MapInlayHandle {
  const { map, isGM, author } = opts;
  let tool: Tool = 'pan';
  let drawing = false;
  let current: MapStrokePoint[] = [];

  const img = h('img', { class: 'player-map-img', attrs: { src: map.url, alt: map.name } });
  const canvas = h('canvas', { class: 'map-draw-canvas' }) as HTMLCanvasElement;
  const layers = h('div', { class: 'map-layers' }, img, canvas);
  const viewport = h('div', { class: 'player-map-viewport' }, layers);
  // labelBox is appended to the viewport after it's declared below.
  const pz = attachPanZoom(viewport, layers);
  const ctx = canvas.getContext('2d')!;

  // The acting author, read live so a mid-session colour/name change is honoured
  // (the inlay isn't rebuilt on store updates, so the captured `author` goes stale).
  function currentAuthor(): MapAuthor {
    if (isGM) return author;
    const id = store.getState().identity;
    return id ? { name: id.name, color: id.color } : author;
  }

  // ── Inline label editor ──
  // Appears at the pin after it is dropped. Canvas pointer-events are suspended
  // while the editor is open so the canvas can't steal focus back.
  let labelTargetId: string | null = null;
  const labelInput = h('input', {
    class: 'map-label-input',
    attrs: { type: 'text', placeholder: 'Label (optional)', maxlength: '40' },
  }) as HTMLInputElement;
  const labelOk = h('button', {
    class: 'map-label-ok', attrs: { type: 'button', title: 'Save label' }, text: '✓',
  }) as HTMLButtonElement;
  const labelDismiss = h('button', {
    class: 'map-label-dismiss', attrs: { type: 'button', title: 'No label' }, text: '✕',
  }) as HTMLButtonElement;
  const labelBox = h('div', { class: 'map-label-box hidden' }, labelInput, labelOk, labelDismiss);
  viewport.append(labelBox);

  function showLabelEditor(vx: number, vy: number, strokeId: string, existingLabel = ''): void {
    labelTargetId = strokeId;
    labelInput.value = existingLabel;
    labelBox.style.left = `${vx}px`;
    labelBox.style.top = `${vy}px`;
    labelBox.classList.remove('hidden');
    // Suspend canvas interaction so it can't steal focus.
    canvas.style.pointerEvents = 'none';
    setTimeout(() => { labelInput.focus(); labelInput.select(); }, 0);
  }

  function hideLabelEditor(): void {
    labelTargetId = null;
    labelBox.classList.add('hidden');
    // Restore canvas pointer-events if a drawing tool is still active.
    if (tool !== 'pan') canvas.style.pointerEvents = 'auto';
  }

  async function commitLabel(): Promise<void> {
    const id = labelTargetId;
    if (!id) return;
    const label = labelInput.value.trim();
    hideLabelEditor();
    // Optimistic update (empty label just clears it).
    store.set({ mapStrokes: store.getState().mapStrokes.map((m) => (m.id === id ? { ...m, label } : m)) });
    if (id.startsWith('tmp-')) return;
    try { await strokeRepo.setLabel(id, label); }
    catch { toast('Could not save label.'); }
  }

  labelOk.addEventListener('click', () => void commitLabel());
  labelDismiss.addEventListener('click', hideLabelEditor);
  labelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void commitLabel();
    if (e.key === 'Escape') hideLabelEditor();
  });

  // ── Canvas sizing: backing store matches the image's natural pixels. ──
  function sizeCanvas(): void {
    const w = img.naturalWidth || img.width;
    const hgt = img.naturalHeight || img.height;
    if (w && hgt && (canvas.width !== w || canvas.height !== hgt)) {
      canvas.width = w;
      canvas.height = hgt;
    }
  }
  if (img.complete) sizeCanvas();
  img.addEventListener('load', () => { sizeCanvas(); draw(); });

  // ── Pin drag state ──
  let draggingPin: MapStrokeRow | null = null;
  let dragCurrent: MapStrokePoint | null = null;
  let dragOrigin: MapStrokePoint | null = null; // pointer-down position, to detect tap vs drag

  // ── Drawing ──
  function caseStrokes(): MapStrokeRow[] {
    const s = store.getState();
    return s.mapStrokes.filter((m) => m.case_id === s.currentCaseId);
  }

  function drawStroke(points: MapStrokePoint[], color: string): void {
    if (points.length < 1) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.5, canvas.width * 0.003);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
    ctx.stroke();
  }

  // Compact map pin: circle head above, straight sides tapering to a sharp tip.
  // `p` is the anchor point (tip of the pin). Head radius kept small so it
  // doesn't obscure the map for neighbouring players.
  function drawPin(p: MapStrokePoint, color: string, label: string): void {
    const cx = p.x * canvas.width;
    const cy = p.y * canvas.height; // tip
    const r = Math.max(5, canvas.width * 0.007); // smaller than before
    const headCy = cy - r * 2.1; // centre of the circle head

    ctx.save();
    ctx.beginPath();
    // Arc from bottom-right (~150° CCW = 30°) clockwise around the top to bottom-left (~210°).
    // Leaves a gap at the bottom of the circle that the two straight sides fill.
    ctx.arc(cx, headCy, r, Math.PI / 6, Math.PI * (5 / 6), false);
    ctx.lineTo(cx, cy); // right side → tip
    ctx.closePath();    // tip → left arc start

    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.strokeStyle = 'rgba(20,14,6,0.8)';
    ctx.stroke();

    // White centre dot
    ctx.beginPath();
    ctx.arc(cx, headCy, r * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.restore();

    // Label to the right of the head
    if (label) {
      const fontSize = Math.max(10, canvas.width * 0.011);
      ctx.save();
      ctx.font = `bold ${fontSize}px Georgia, serif`;
      ctx.textBaseline = 'middle';
      const textX = cx + r * 1.4;
      const textY = headCy;
      const metrics = ctx.measureText(label);
      const pad = fontSize * 0.3;
      ctx.fillStyle = 'rgba(20,14,6,0.72)';
      ctx.beginPath();
      ctx.roundRect(textX - pad, textY - fontSize * 0.6 - pad, metrics.width + pad * 2, fontSize * 1.2 + pad * 2, [4]);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, textX, textY);
      ctx.restore();
    }
  }

  function draw(): void {
    if (!canvas.width || !canvas.height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const m of caseStrokes()) {
      if (m.kind === 'pin') {
        const pt = (draggingPin?.id === m.id && dragCurrent) ? dragCurrent : (m.points[0] ?? { x: 0.5, y: 0.5 });
        // Suppress label while dragging so it doesn't trail across the map.
        drawPin(pt, m.player_color, draggingPin?.id === m.id ? '' : (m.label ?? ''));
      } else {
        drawStroke(m.points, m.player_color);
      }
    }
    if (drawing && current.length) drawStroke(current, currentAuthor().color);
  }

  // ── Pointer → normalised coordinates ──
  function toNorm(e: PointerEvent): MapStrokePoint {
    const rect = canvas.getBoundingClientRect();
    const clamp = (v: number): number => Math.min(1, Math.max(0, v));
    return { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) };
  }

  // ── Persistence (optimistic, reconciled by id; realtime keeps others fresh) ──
  // Returns the persisted row's id, or null if the save failed.
  async function addMarking(kind: 'stroke' | 'pin', points: MapStrokePoint[], label = ''): Promise<string | null> {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return null;
    const me = currentAuthor();
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: MapStrokeRow = {
      id: tempId, case_id: caseId, player_name: me.name, player_color: me.color,
      kind, points, label, created_at: new Date().toISOString(),
    };
    store.set({ mapStrokes: [...store.getState().mapStrokes, optimistic] });
    try {
      const saved = await strokeRepo.create({
        case_id: caseId, player_name: me.name, player_color: me.color, kind, points, label,
      });
      store.set({ mapStrokes: store.getState().mapStrokes.map((m) => (m.id === tempId ? saved : m)) });
      return saved.id;
    } catch {
      store.set({ mapStrokes: store.getState().mapStrokes.filter((m) => m.id !== tempId) });
      toast('Could not save marking.');
      return null;
    }
  }

  async function movePin(m: MapStrokeRow, newPoint: MapStrokePoint): Promise<void> {
    const prev = store.getState().mapStrokes;
    store.set({ mapStrokes: prev.map((s) => s.id === m.id ? { ...s, points: [newPoint] } : s) });
    if (m.id.startsWith('tmp-')) return;
    try { await strokeRepo.move(m.id, [newPoint]); }
    catch { store.set({ mapStrokes: prev }); toast('Could not move pin.'); }
  }

  // Drop a pin immediately, then open the inline label editor over it.
  async function placePinAndEdit(p: MapStrokePoint, vx: number, vy: number): Promise<void> {
    const id = await addMarking('pin', [p]);
    if (id) showLabelEditor(vx, vy, id);
  }

  function canErase(m: MapStrokeRow): boolean {
    const me = currentAuthor();
    return isGM || (m.player_name === me.name && m.player_color === me.color);
  }

  function distToSegment(p: MapStrokePoint, a: MapStrokePoint, b: MapStrokePoint): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = Math.min(1, Math.max(0, t));
    const cx = a.x + t * dx, cy = a.y + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }

  function hitMarking(p: MapStrokePoint): MapStrokeRow | null {
    // Topmost (last drawn) first.
    const list = caseStrokes();
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.kind === 'pin') {
        if (m.points[0] && Math.hypot(p.x - m.points[0].x, p.y - m.points[0].y) < ERASE_HIT) return m;
      } else {
        for (let j = 1; j < m.points.length; j++) {
          if (distToSegment(p, m.points[j - 1], m.points[j]) < ERASE_HIT) return m;
        }
        // Single-point stroke fallback.
        if (m.points.length === 1 && Math.hypot(p.x - m.points[0].x, p.y - m.points[0].y) < ERASE_HIT) return m;
      }
    }
    return null;
  }

  async function eraseAt(p: MapStrokePoint): Promise<void> {
    const m = hitMarking(p);
    if (!m) return;
    if (!canErase(m)) { toast('Only the author or the GM can erase this.'); return; }
    const prev = store.getState().mapStrokes;
    store.set({ mapStrokes: prev.filter((x) => x.id !== m.id) });
    if (m.id.startsWith('tmp-')) return; // never persisted
    try { await strokeRepo.remove(m.id); }
    catch { store.set({ mapStrokes: prev }); toast('Could not erase.'); }
  }

  // ── Pointer handlers (active only when a tool is selected) ──
  // Threshold for distinguishing a drag from a tap (normalised units).
  const DRAG_MIN = 0.008;

  function onPointerDown(e: PointerEvent): void {
    if (tool === 'pan' || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const p = toNorm(e);

    if (tool === 'pin') {
      // Start dragging an existing own pin if the pointer lands on one.
      const hit = hitMarking(p);
      if (hit?.kind === 'pin' && canErase(hit)) {
        draggingPin = hit;
        dragOrigin = p;
        dragCurrent = p;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        return;
      }
      // Otherwise drop a new pin.
      const vrect = viewport.getBoundingClientRect();
      void placePinAndEdit(p, e.clientX - vrect.left, e.clientY - vrect.top);
      return;
    }

    if (tool === 'erase') { void eraseAt(p); return; }

    // draw
    drawing = true;
    current = [p];
    canvas.setPointerCapture(e.pointerId);
    draw();
  }

  function onPointerMove(e: PointerEvent): void {
    // Pin drag.
    if (draggingPin) {
      e.stopPropagation();
      dragCurrent = toNorm(e);
      draw();
      return;
    }
    // Hover cursor feedback: show grab when over a movable pin in pin mode.
    if (tool === 'pin' && !drawing) {
      const hit = hitMarking(toNorm(e));
      canvas.style.cursor = (hit?.kind === 'pin' && canErase(hit)) ? 'grab' : 'crosshair';
    }
    if (!drawing) return;
    e.stopPropagation();
    current.push(toNorm(e));
    draw();
  }

  function onPointerUp(e: PointerEvent): void {
    // Finish pin drag.
    if (draggingPin) {
      e.stopPropagation();
      const pin = draggingPin;
      const dest = dragCurrent ?? pin.points[0] ?? { x: 0.5, y: 0.5 };
      const moved = dragOrigin ? Math.hypot(dest.x - dragOrigin.x, dest.y - dragOrigin.y) > DRAG_MIN : false;
      draggingPin = null;
      dragCurrent = null;
      dragOrigin = null;
      canvas.style.cursor = 'crosshair';
      if (moved) {
        void movePin(pin, dest);
      } else {
        // Short tap on own pin → edit its label.
        const vrect = viewport.getBoundingClientRect();
        showLabelEditor(e.clientX - vrect.left, e.clientY - vrect.top, pin.id, pin.label ?? '');
      }
      return;
    }
    if (!drawing) return;
    e.stopPropagation();
    drawing = false;
    const pts = current;
    current = [];
    if (pts.length >= 2) void addMarking('stroke', pts);
    else draw();
  }
  function onPointerCancel(): void {
    if (draggingPin) {
      // Revert the drag ghost and cancel.
      draggingPin = null; dragCurrent = null; dragOrigin = null;
      canvas.style.cursor = 'crosshair';
      draw();
      return;
    }
    if (drawing) { drawing = false; current = []; draw(); }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  // ── Tool selection ──
  function setTool(next: Tool): void {
    tool = next;
    const drawingTool = next !== 'pan';
    canvas.style.pointerEvents = drawingTool ? 'auto' : 'none';
    canvas.style.cursor = next === 'erase' ? 'cell' : next === 'pan' ? 'default' : 'crosshair';
    pz.setPanEnabled(!drawingTool);
    for (const [t, btn] of Object.entries(toolButtons)) btn.classList.toggle('active', t === next);
  }

  function toolBtn(t: Tool, icon: string, title: string): HTMLButtonElement {
    return h('button', {
      class: 'map-ctrl-btn map-tool-btn', text: icon, attrs: { title },
      on: { click: () => setTool(t) },
    }) as HTMLButtonElement;
  }

  const toolButtons: Record<Tool, HTMLButtonElement> = {
    pan: toolBtn('pan', '✋', 'Pan / zoom'),
    draw: toolBtn('draw', '✏️', 'Draw (marker)'),
    pin: toolBtn('pin', '📍', 'Drop a pin'),
    erase: toolBtn('erase', '🧽', 'Erase your markings'),
  };

  async function clearAllMarkings(): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;
    if (!confirm('Clear all markings from the map? This cannot be undone.')) return;
    const prev = store.getState().mapStrokes;
    store.set({ mapStrokes: [] });
    try { await strokeRepo.clearForCase(caseId); }
    catch { store.set({ mapStrokes: prev }); toast('Could not clear markings.'); }
  }

  const clearBtn = isGM
    ? h('button', { class: 'map-ctrl-btn map-ctrl-danger', text: '🗑', attrs: { title: 'Clear all markings' }, on: { click: () => void clearAllMarkings() } })
    : null;

  const ctrls = h('div', { class: 'map-ctrl-bar' },
    toolButtons.pan, toolButtons.draw, toolButtons.pin, toolButtons.erase,
    h('span', { class: 'map-ctrl-sep' }),
    h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' }, on: { click: () => pz.reset() } }),
    h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' }, on: { click: () => pz.zoomOut() } }),
    h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' }, on: { click: () => pz.zoomIn() } }),
    h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' }, on: { click: () => openMapViewer(map.url, map.name) } }),
    ...(clearBtn ? [h('span', { class: 'map-ctrl-sep' }), clearBtn] : []),
  );

  setTool('pan');

  // Redraw whenever markings change (realtime → store → here).
  const unsub = store.subscribe(() => draw());
  draw();

  const element = h('div', { class: 'player-map-inlay' }, viewport, ctrls);

  return {
    element,
    detach() {
      unsub();
      pz.detach();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      clear(element);
    },
  };
}
