// ── Player screen ──
// Tabbed layout: left panel has tabs (Briefing / Clues / Newspaper / Directory / Map),
// right panel is always the notebook. Notes stay interactive regardless of which tab
// is open. Newspaper renders inline as PDF.js canvases — no overlay.

import { h, replaceChildren, clear } from '../util/dom';
import { store, selectors, type AppState } from '../state/store';
import type { ClueRow, NoteRow, NewspaperRow } from '../data/types';
import { notes as noteRepo } from '../data/supabase';
import { createNotebook, noteCard, noteEditor, noteComposer, fillFeed } from '../components/notebook';
import { openMapViewer } from '../components/mapViewer';
import { buildDirectory } from '../components/directory';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { leaveCase } from './join';

export interface ScreenHandle {
  element: HTMLElement;
  destroy(): void;
}

type TabId = 'briefing' | 'clues' | 'newspaper' | 'directory' | 'map';

export function createPlayerScreen(): ScreenHandle {
  let editingId: string | null = null;
  let selectedClueId: string | null = null;
  let activeTab: TabId = 'clues';

  // ── Header (slim — just title + leave) ──
  const caseTitle = h('h1', { class: 'screen-title' });
  const leaveBtn = h('button', { class: 'btn btn-secondary btn-sm', text: 'Leave', on: { click: leaveCase } });
  const header = h('header', { class: 'player-header' }, caseTitle, leaveBtn);

  // ── Tab bar ──
  const TAB_DEFS: { id: TabId; label: string }[] = [
    { id: 'briefing',  label: 'Case Brief' },
    { id: 'clues',     label: 'Clues' },
    { id: 'newspaper', label: 'Newspaper' },
    { id: 'directory', label: 'Directory' },
    { id: 'map',       label: 'Map' },
  ];

  const tabButtons: Partial<Record<TabId, HTMLElement>> = {};
  const tabBar = h('div', { class: 'player-tab-bar' });

  function switchTab(id: TabId): void {
    activeTab = id;
    for (const [tid, btn] of Object.entries(tabButtons)) {
      btn?.classList.toggle('active', tid === id);
    }
    renderPanel(store.getState());
  }

  for (const { id, label } of TAB_DEFS) {
    const btn = h('button', {
      class: 'player-tab-btn' + (id === activeTab ? ' active' : ''),
      text: label,
      on: { click: () => switchTab(id) },
    });
    tabButtons[id] = btn;
    tabBar.append(btn);
  }

  // ── Main panel (tab content) ──
  const panelEl = h('div', { class: 'player-panel' });

  // ── Clue detail (inline, inside panel) ──
  const clueDetail = h('div', { class: 'clue-detail' });
  const clueGrid = h('div', { class: 'clues-grid' });
  const cluesPanel = h('div', {}, clueDetail, clueGrid);

  // ── Briefing panel ──
  const briefingPanel = h('div', { class: 'player-briefing-panel' });

  // ── Newspaper panel (inline PDF.js) ──
  const newspaperPanel = h('div', { class: 'player-newspaper-panel' });

  // ── Directory panel (inline; built once, retains search state) ──
  const directoryPanel = h('div', { class: 'player-directory-panel' });

  // ── Map panel (inline image + expand-to-overlay) ──
  const mapPanel = h('div', { class: 'player-map-panel' });

  // ── Notebook (always right) ──
  const privateFeed = h('div', { class: 'nb-notes' });
  const sharedFeed = h('div', { class: 'nb-notes' });
  const privateContent = h('div', {},
    noteComposer({ placeholder: 'Record your private deductions…', onSubmit: (t) => addNote(t, true) }),
    privateFeed,
  );
  const sharedContent = h('div', {},
    noteComposer({ placeholder: 'Share your deductions with the team…', onSubmit: (t) => addNote(t, false) }),
    sharedFeed,
  );
  const notebook = createNotebook([
    { id: 'private', label: 'My Notes', content: privateContent },
    { id: 'shared',  label: 'Team Notes', content: sharedContent },
  ]);
  const notebookWrap = h('aside', { class: 'player-notebook' }, notebook.element);

  const element = h('div', { class: 'player-screen' },
    header,
    h('div', { class: 'player-body' },
      h('div', { class: 'player-main' }, tabBar, panelEl),
      notebookWrap,
    ),
  );

  // ── Mutations ──
  async function addNote(text: string, isPrivate: boolean): Promise<void> {
    const id = store.getState().currentCaseId;
    const me = store.getState().identity;
    if (!id || !me) return;
    try {
      await noteRepo.create({ case_id: id, player_name: me.name, player_color: me.color, content: text, is_private: isPrivate });
    } catch { toast('Could not save note.'); }
  }

  async function shareNote(note: NoteRow): Promise<void> {
    try { await noteRepo.setPrivate(note.id, false); toast('Shared with the team.'); }
    catch { toast('Could not share note.'); }
  }

  async function deleteNote(note: NoteRow): Promise<void> {
    if (!(await confirmDelete('Delete this note?'))) return;
    const caseId = store.getState().currentCaseId;
    try {
      await noteRepo.remove(note.id);
      if (caseId) store.set({ notes: await noteRepo.listForCase(caseId) });
    } catch { toast('Could not delete note.'); }
  }

  async function saveEdit(note: NoteRow, text: string): Promise<void> {
    editingId = null;
    try { await noteRepo.updateContent(note.id, text); }
    catch { toast('Could not save edit.'); renderNotes(store.getState()); }
  }

  // ── Rendering ──
  function clueCard(c: ClueRow): HTMLElement {
    const body = c.clue_text
      ? h('div', { class: 'revealed-card-text', text: c.clue_text })
      : h('img', { attrs: { src: c.image_url, alt: c.location_name } });
    return h('div', {
      class: 'revealed-card' + (c.id === selectedClueId ? ' selected' : ''),
      on: { click: () => openClue(c) },
    }, body, h('div', { class: 'revealed-card-label' }, `${c.location_name} ⤢`));
  }

  function openClue(c: ClueRow): void {
    selectedClueId = selectedClueId === c.id ? null : c.id;
    renderDetail(store.getState());
    renderClues(store.getState());
  }

  function closeDetail(): void {
    selectedClueId = null;
    renderDetail(store.getState());
    renderClues(store.getState());
  }

  function renderDetail(s: AppState): void {
    const c = selectedClueId ? selectors.revealedClues(s).find((x) => x.id === selectedClueId) : null;
    if (!c) { selectedClueId = null; clueDetail.hidden = true; replaceChildren(clueDetail); return; }
    clueDetail.hidden = false;
    const closeBtn = h('button', { class: 'clue-detail-close', text: '✕', attrs: { 'aria-label': 'Close clue' }, on: { click: closeDetail } });
    const head = h('div', { class: 'clue-detail-head' },
      h('span', { class: 'clue-detail-title', text: c.location_name }), closeBtn);
    const bodyContent = c.clue_text
      ? h('div', { class: 'clue-detail-text', text: c.clue_text })
      : h('img', { class: 'clue-detail-img', attrs: { src: c.image_url, alt: c.location_name },
          on: { click: () => openMapViewer(c.image_url!, c.location_name) } });
    replaceChildren(clueDetail, head, bodyContent);
  }

  function renderClues(s: AppState): void {
    const revealed = selectors.revealedClues(s);
    if (!revealed.length) {
      replaceChildren(clueGrid, h('div', { class: 'empty-state', text: 'Awaiting the Game Master to reveal clues…' }));
      return;
    }
    replaceChildren(clueGrid, ...revealed.map(clueCard));
  }

  function renderBriefing(s: AppState): void {
    const current = selectors.currentCase(s);
    const desc = current?.description?.trim();
    if (desc) {
      replaceChildren(briefingPanel, h('p', { class: 'briefing-text', text: desc }));
    } else {
      replaceChildren(briefingPanel, h('p', { class: 'empty-state', text: 'No briefing for this case yet.' }));
    }
  }

  function renderNewspaper(s: AppState): void {
    clear(newspaperPanel);
    const papers = s.newspapers;
    if (!papers.length) {
      newspaperPanel.append(h('div', { class: 'empty-state', text: 'No newspapers available for this case yet.' }));
      return;
    }
    // Group by owning case (chronological)
    const groups = new Map<number, { name: string; items: NewspaperRow[] }>();
    for (const p of papers) {
      const ord = p.case_ordinal ?? 0;
      if (!groups.has(ord)) groups.set(ord, { name: p.case_name ?? 'Newspapers', items: [] });
      groups.get(ord)!.items.push(p);
    }
    const sorted = [...groups.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, g] of sorted) {
      const isPdf = (p: NewspaperRow) => p.image_url.split('?')[0].toLowerCase().endsWith('.pdf');
      const card = (p: NewspaperRow): HTMLElement => {
        const preview = isPdf(p)
          ? h('div', { class: 'map-thumb map-thumb--pdf', text: '📄', on: { click: () => openMapViewer(p.image_url, p.name) } })
          : h('img', { class: 'map-thumb', attrs: { src: p.image_url, alt: p.name }, on: { click: () => openMapViewer(p.image_url, p.name) } });
        return h('div', { class: 'map-card' }, preview,
          h('div', { class: 'map-card-body' }, h('span', { class: 'newspaper-page-label', text: p.name })));
      };
      if (sorted.length > 1) newspaperPanel.append(h('h3', { class: 'newspaper-group-title', text: g.name }));
      newspaperPanel.append(h('div', { class: 'maps-grid' }, ...g.items.map(card)));
    }
  }

  // Directory is built lazily once so its search box keeps state across tab
  // switches and store re-renders (it manages its own data internally).
  let directoryBuilt = false;
  function renderDirectory(): void {
    if (!directoryBuilt) {
      replaceChildren(directoryPanel, buildDirectory(false));
      directoryBuilt = true;
    }
  }

  function renderMap(s: AppState): void {
    (mapPanel as HTMLElement & { _mapCleanup?: () => void })._mapCleanup?.();
    clear(mapPanel);
    const current = selectors.currentCase(s);
    const map = current?.map_id ? s.maps.find((m) => m.id === current.map_id) : null;
    if (!map) {
      mapPanel.append(h('div', { class: 'empty-state', text: 'No map attached to this case.' }));
      return;
    }

    // Pan/zoom state
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTx = 0;
    let startTy = 0;

    const img = h('img', { class: 'player-map-img', attrs: { src: map.url, alt: map.name } });
    const viewport = h('div', { class: 'player-map-viewport' }, img);

    function applyTransform(): void {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.min(6, Math.max(0.5, scale + delta));
      applyTransform();
    }, { passive: false });

    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTx = tx;
      startTy = ty;
      viewport.style.cursor = 'grabbing';
    });

    function onMouseMove(e: MouseEvent): void {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      applyTransform();
    }
    function onMouseUp(): void {
      if (!dragging) return;
      dragging = false;
      viewport.style.cursor = 'grab';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Clean up window listeners when map panel is next cleared (tab switch / case change)
    const origClear = mapPanel.dataset['cleanup'];
    void origClear;
    (mapPanel as HTMLElement & { _mapCleanup?: () => void })._mapCleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    const fullscreenBtn = h('button', {
      class: 'player-map-fullscreen-btn',
      text: '⤢',
      attrs: { title: 'Open fullscreen' },
      on: { click: () => openMapViewer(map.url, map.name) },
    });

    mapPanel.append(h('div', { class: 'player-map-inlay' }, viewport, fullscreenBtn));
  }

  function renderPanel(s: AppState): void {
    if (activeTab === 'briefing') {
      renderBriefing(s);
      replaceChildren(panelEl, briefingPanel);
    } else if (activeTab === 'clues') {
      renderDetail(s);
      renderClues(s);
      replaceChildren(panelEl, cluesPanel);
    } else if (activeTab === 'newspaper') {
      renderNewspaper(s);
      replaceChildren(panelEl, newspaperPanel);
    } else if (activeTab === 'directory') {
      renderDirectory();
      replaceChildren(panelEl, directoryPanel);
    } else if (activeTab === 'map') {
      renderMap(s);
      replaceChildren(panelEl, mapPanel);
    }
  }

  function renderNotes(s: AppState): void {
    const me = s.identity;
    const priv = selectors.ownPrivateNotes(s).map((n) => noteRow(n, true));
    fillFeed(privateFeed, priv, 'No private notes yet.');
    const shared = selectors.sharedNotes(s)
      .map((n) => noteRow(n, !!me && n.player_name === me.name && n.player_color === me.color));
    fillFeed(sharedFeed, shared, 'No team notes yet. Be the first to record a deduction.');
  }

  function ownNoteActions(note: NoteRow): ReturnType<typeof noteCard> {
    const isPrivate = note.is_private;
    return noteCard({
      name: note.player_name, color: note.player_color, time: note.created_at, text: note.content,
      badge: isPrivate ? 'Private' : undefined,
      actions: [
        { label: '✎ Edit', onClick: () => { editingId = note.id; renderNotes(store.getState()); } },
        ...(isPrivate ? [{ label: '↗ Share', onClick: () => void shareNote(note) }] : []),
        { label: '✕', danger: true, onClick: () => void deleteNote(note) },
      ],
    });
  }

  function noteRow(note: NoteRow, mine: boolean): HTMLElement {
    if (mine && editingId === note.id) {
      return noteEditor(note.content, (text) => void saveEdit(note, text),
        () => { editingId = null; renderNotes(store.getState()); });
    }
    if (mine) return ownNoteActions(note);
    return noteCard({ name: note.player_name, color: note.player_color, time: note.created_at, text: note.content });
  }

  function renderChrome(s: AppState): void {
    const current = selectors.currentCase(s);
    caseTitle.textContent = current?.name ?? '';
    // Show/hide tab buttons based on available content
    const hasMap = !!current?.map_id;
    const hasNews = s.newspapers.length > 0;
    if (tabButtons.map) tabButtons.map.style.display = hasMap ? '' : 'none';
    if (tabButtons.newspaper) tabButtons.newspaper.style.display = hasNews ? '' : 'none';
    // If active tab became hidden, fall back to clues
    if ((activeTab === 'map' && !hasMap) || (activeTab === 'newspaper' && !hasNews)) {
      switchTab('clues');
    }
  }

  function render(s: AppState): void {
    renderChrome(s);
    renderPanel(s);
    renderNotes(s);
  }

  const unsubscribe = store.subscribe(render);
  render(store.getState());

  return {
    element,
    destroy() {
      unsubscribe();
      (mapPanel as HTMLElement & { _mapCleanup?: () => void })._mapCleanup?.();
    },
  };
}
