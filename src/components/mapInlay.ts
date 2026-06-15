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

  // ── Inline label editor ──
  // After a pin is dropped, a small text box appears on the map at the pin so
  // the player can optionally name it. Positioned in viewport pixels at drop time.
  let labelTargetId: string | null = null;
  const labelInput = h('input', {
    class: 'map-label-input',
    attrs: { type: 'text', placeholder: 'Label this pin…', maxlength: '40' },
  }) as HTMLInputElement;
  const labelBox = h('div', { class: 'map-label-box hidden' }, labelInput);
  viewport.append(labelBox);

  function showLabelEditor(vx: number, vy: number, strokeId: string): void {
    labelTargetId = strokeId;
    labelInput.value = '';
    labelBox.style.left = `${vx}px`;
    labelBox.style.top = `${vy}px`;
    labelBox.classList.remove('hidden');
    setTimeout(() => labelInput.focus(), 0);
  }

  function hideLabelEditor(): void {
    labelTargetId = null;
    labelBox.classList.add('hidden');
  }

  async function commitLabel(): Promise<void> {
    const id = labelTargetId;
    if (!id) return;
    const label = labelInput.value.trim();
    hideLabelEditor();
    if (!label) return;
    // Optimistic store update so the label renders immediately.
    store.set({ mapStrokes: store.getState().mapStrokes.map((m) => (m.id === id ? { ...m, label } : m)) });
    if (id.startsWith('tmp-')) return; // not yet persisted; skip
    try { await strokeRepo.setLabel(id, label); }
    catch { toast('Could not save label.'); }
  }

  labelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void commitLabel();
    if (e.key === 'Escape') hideLabelEditor();
  });
  labelInput.addEventListener('blur', () => void commitLabel());

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

  // Google Maps-style teardrop pin: filled balloon with a downward point.
  function drawPin(p: MapStrokePoint, color: string, label: string): void {
    const cx = p.x * canvas.width;
    const cy = p.y * canvas.height;
    const r = Math.max(8, canvas.width * 0.011);
    const tipY = cy + r * 2.2; // tip of the teardrop below the centre

    ctx.save();
    ctx.beginPath();
    // Circle top
    ctx.arc(cx, cy - r * 0.4, r, Math.PI * 0.18, Math.PI * 0.82, false);
    // Bezier to tip
    ctx.bezierCurveTo(cx + r * 1.1, cy + r * 1.2, cx + r * 0.35, tipY - r * 0.4, cx, tipY);
    ctx.bezierCurveTo(cx - r * 0.35, tipY - r * 0.4, cx - r * 1.1, cy + r * 1.2, cx, cy - r * 0.4 - r * Math.sin(Math.PI * 0.18));
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.2);
    ctx.strokeStyle = 'rgba(20,14,6,0.75)';
    ctx.stroke();

    // White centre dot
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.4, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.restore();

    // Label to the right
    if (label) {
      const fontSize = Math.max(11, canvas.width * 0.013);
      ctx.save();
      ctx.font = `bold ${fontSize}px Georgia, serif`;
      ctx.textBaseline = 'middle';
      const textX = cx + r * 1.5;
      const textY = cy - r * 0.4;
      // Background pill
      const metrics = ctx.measureText(label);
      const pad = fontSize * 0.35;
      ctx.fillStyle = 'rgba(20,14,6,0.72)';
      ctx.beginPath();
      const bx = textX - pad;
      const by = textY - fontSize * 0.6 - pad;
      const bw = metrics.width + pad * 2;
      const bh = fontSize * 1.2 + pad * 2;
      ctx.roundRect(bx, by, bw, bh, [4]);
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
      if (m.kind === 'pin') drawPin(m.points[0] ?? { x: 0.5, y: 0.5 }, m.player_color, m.label ?? '');
      else drawStroke(m.points, m.player_color);
    }
    if (drawing && current.length) drawStroke(current, author.color);
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
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: MapStrokeRow = {
      id: tempId, case_id: caseId, player_name: author.name, player_color: author.color,
      kind, points, label, created_at: new Date().toISOString(),
    };
    store.set({ mapStrokes: [...store.getState().mapStrokes, optimistic] });
    try {
      const saved = await strokeRepo.create({
        case_id: caseId, player_name: author.name, player_color: author.color, kind, points, label,
      });
      store.set({ mapStrokes: store.getState().mapStrokes.map((m) => (m.id === tempId ? saved : m)) });
      return saved.id;
    } catch {
      store.set({ mapStrokes: store.getState().mapStrokes.filter((m) => m.id !== tempId) });
      toast('Could not save marking.');
      return null;
    }
  }

  // Drop a pin immediately, then open the inline label editor over it.
  async function placePin(p: MapStrokePoint, vx: number, vy: number): Promise<void> {
    const id = await addMarking('pin', [p]);
    if (id) showLabelEditor(vx, vy, id);
  }

  function canErase(m: MapStrokeRow): boolean {
    return isGM || (m.player_name === author.name && m.player_color === author.color);
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
  function onPointerDown(e: PointerEvent): void {
    if (tool === 'pan' || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const p = toNorm(e);
    if (tool === 'pin') {
      const vrect = viewport.getBoundingClientRect();
      void placePin(p, e.clientX - vrect.left, e.clientY - vrect.top);
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
    if (!drawing) return;
    e.stopPropagation();
    current.push(toNorm(e));
    draw();
  }
  function onPointerUp(e: PointerEvent): void {
    if (!drawing) return;
    e.stopPropagation();
    drawing = false;
    const pts = current;
    current = [];
    if (pts.length >= 2) void addMarking('stroke', pts);
    else draw();
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

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

  const ctrls = h('div', { class: 'map-ctrl-bar' },
    toolButtons.pan, toolButtons.draw, toolButtons.pin, toolButtons.erase,
    h('span', { class: 'map-ctrl-sep' }),
    h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' }, on: { click: () => pz.reset() } }),
    h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' }, on: { click: () => pz.zoomOut() } }),
    h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' }, on: { click: () => pz.zoomIn() } }),
    h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' }, on: { click: () => openMapViewer(map.url, map.name) } }),
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
      canvas.removeEventListener('pointercancel', onPointerUp);
      clear(element);
    },
  };
}
