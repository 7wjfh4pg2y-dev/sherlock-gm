// ── Player screen ──
// Tabbed layout: left panel has tabs (Briefing / Clues / Newspaper / Directory / Map),
// right panel is always the notebook. Notes stay interactive regardless of which tab
// is open. Newspaper renders inline as PDF.js canvases — no overlay.

import { h, replaceChildren, clear } from '../util/dom';
import { store, selectors, type AppState } from '../state/store';
import type { ClueRow, NoteRow, NewspaperRow, QuestionRow } from '../data/types';
import { notes as noteRepo, questionAnswers } from '../data/supabase';
import { createNotebook, noteCard, noteEditor, noteComposer, fillFeed } from '../components/notebook';
import { openMapViewer } from '../components/mapViewer';
import { buildDirectory } from '../components/directory';
import { attachPanZoom, type PanZoomHandle } from '../util/panZoom';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { leaveCase } from './join';

export interface ScreenHandle {
  element: HTMLElement;
  destroy(): void;
}

type TabId = 'briefing' | 'clues' | 'questions' | 'solution' | 'newspaper' | 'directory' | 'map';

export function createPlayerScreen(): ScreenHandle {
  let editingId: string | null = null;
  let selectedClueId: string | null = null;
  let editingAnswerId: string | null = null;
  let answerDraft = '';
  let activeTab: TabId = 'clues';
  let mapPanZoom: PanZoomHandle | null = null;
  let builtMapId: string | null = null;
  let newspaperPdfHandle: { destroy(): void; zoomIn(): void; zoomOut(): void; reset(): void } | null = null;
  let builtNewspaperUrl: string | null = null;
  let currentNewspaperUrl: string | null = null;

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
    { id: 'questions', label: 'Questions' },
    { id: 'solution',  label: 'Solution' },
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

  // ── Questions + Solution panels ──
  const questionsPanel = h('div', { class: 'player-questions-panel' });
  const solutionPanel = h('div', { class: 'player-solution-panel' });

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

  async function saveTeamAnswer(q: QuestionRow): Promise<void> {
    const caseId = store.getState().currentCaseId;
    const me = store.getState().identity;
    if (!caseId || !me) return;
    const content = answerDraft.trim();
    editingAnswerId = null;
    try {
      await questionAnswers.save(caseId, q.id, content, me.name, me.color);
      // Optimistic local update so the answer shows immediately (realtime confirms).
      const others = store.getState().questionAnswers.filter((a) => a.question_id !== q.id);
      store.set({
        questionAnswers: [
          ...others,
          { question_id: q.id, case_id: caseId, content, updated_by: me.name, updated_color: me.color, updated_at: new Date().toISOString() },
        ],
      });
    } catch {
      toast('Could not save the team answer.');
      renderPanel(store.getState());
    }
  }

  function questionCard(q: QuestionRow, index: number, s: AppState): HTMLElement {
    const team = selectors.teamAnswerFor(s, q.id);
    const head = h('div', { class: 'player-question-head' },
      h('span', { class: 'player-question-num', text: `Q${index + 1}` }),
      h('span', { class: 'player-question-prompt', text: q.prompt }),
      h('span', { class: 'points-badge', text: `${q.points} pts` }),
    );

    let answerBlock: HTMLElement;
    if (editingAnswerId === q.id) {
      const textarea = h('textarea', {
        class: 'gm-input player-answer-textarea',
        attrs: { rows: '3', placeholder: 'Type the team’s answer…' },
        on: { input: (e: Event) => { answerDraft = (e.target as HTMLTextAreaElement).value; } },
      }) as HTMLTextAreaElement;
      textarea.value = answerDraft;
      const saveBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Save', on: { click: () => void saveTeamAnswer(q) } });
      const cancelBtn = h('button', { class: 'btn btn-secondary btn-sm', text: 'Cancel', on: { click: () => { editingAnswerId = null; renderPanel(store.getState()); } } });
      answerBlock = h('div', { class: 'player-answer-edit' }, textarea, h('div', { class: 'player-answer-edit-row' }, saveBtn, cancelBtn));
      setTimeout(() => textarea.focus(), 0);
    } else {
      const editBtn = h('button', {
        class: 'btn btn-secondary btn-sm',
        text: team?.content ? '✏️ Edit team answer' : '✎ Add team answer',
        on: { click: () => { editingAnswerId = q.id; answerDraft = team?.content ?? ''; renderPanel(store.getState()); } },
      });
      answerBlock = h('div', { class: 'player-answer-display' },
        h('span', { class: 'player-answer-label', text: 'Team answer' }),
        team?.content
          ? h('p', { class: 'player-answer-text' }, team.content,
              h('span', { class: 'player-answer-by', text: team.updated_by ? ` — ${team.updated_by}` : '' }))
          : h('p', { class: 'player-answer-empty', text: 'No answer yet — agree on one as a team and record it here.' }),
        editBtn,
      );
    }

    const children: (HTMLElement | null)[] = [head, answerBlock];
    if (q.revealed && q.answer) {
      children.push(h('div', { class: 'player-official-answer' },
        h('span', { class: 'player-answer-label', text: 'Official answer' }),
        h('p', { class: 'player-official-answer-text', text: q.answer }),
      ));
    }
    return h('div', { class: 'player-question-card' }, ...children.filter(Boolean) as HTMLElement[]);
  }

  function renderQuestions(s: AppState): void {
    const qs = s.questions;
    if (!qs.length) {
      replaceChildren(questionsPanel, h('div', { class: 'empty-state', text: 'No questions have been set for this case yet.' }));
      return;
    }
    const children: (HTMLElement | null)[] = [
      h('p', { class: 'player-questions-intro', text: `Answer the case questions together — ${selectors.totalPoints(s)} points in play.` }),
    ];
    const groups: { key: 'main' | 'additional'; label: string }[] = [
      { key: 'main', label: 'Main Questions' },
      { key: 'additional', label: 'Additional Questions' },
    ];
    for (const g of groups) {
      const items = qs.filter((q) => (q.category === 'additional') === (g.key === 'additional'));
      if (!items.length) continue;
      children.push(h('div', { class: 'player-question-group-head', text: g.label }));
      items.forEach((q, i) => children.push(questionCard(q, i, s)));
    }
    replaceChildren(questionsPanel, ...children);
  }

  function renderSolution(s: AppState): void {
    const sol = s.solution;
    if (sol?.revealed && sol.content) {
      replaceChildren(solutionPanel, h('p', { class: 'briefing-text', text: sol.content }));
    } else {
      replaceChildren(solutionPanel, h('div', { class: 'empty-state', text: 'Sherlock has not revealed his solution yet.' }));
    }
  }

  function buildNewspaperInlay(paper: NewspaperRow, allPapers: NewspaperRow[]): void {
    // Don't rebuild if the same paper is already displayed.
    if (paper.image_url === builtNewspaperUrl && newspaperPanel.childElementCount > 0) return;
    newspaperPdfHandle?.destroy();
    newspaperPdfHandle = null;
    builtNewspaperUrl = paper.image_url;
    clear(newspaperPanel);

    // Selector strip when multiple papers available.
    if (allPapers.length > 1) {
      const strip = h('div', { class: 'newspaper-selector' });
      for (const p of allPapers) {
        strip.append(h('button', {
          class: 'newspaper-selector-btn' + (p.image_url === paper.image_url ? ' active' : ''),
          text: p.name,
          on: {
            click: () => {
              currentNewspaperUrl = p.image_url;
              builtNewspaperUrl = null; // force rebuild
              buildNewspaperInlay(p, allPapers);
            },
          },
        }));
      }
      newspaperPanel.append(strip);
    }

    // Inline PDF inlay.
    const scrollEl = h('div', { class: 'pdf-inlay-scroll' },
      h('div', { class: 'pdf-viewer-status', text: 'Loading…' }));

    let handle: { destroy(): void; zoomIn(): void; zoomOut(): void; reset(): void } | null = null;

    const ctrls = h('div', { class: 'map-ctrl-bar' },
      h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' },  on: { click: () => handle?.reset() } }),
      h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' },     on: { click: () => handle?.zoomOut() } }),
      h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' },      on: { click: () => handle?.zoomIn() } }),
      h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' }, on: { click: () => openMapViewer(paper.image_url, paper.name) } }),
    );

    const inlay = h('div', { class: 'player-newspaper-inlay' }, scrollEl, ctrls);
    newspaperPanel.append(inlay);

    void import('../components/pdfViewer').then((m) => {
      const pdfHandle = m.createInlinePdfViewer(paper.image_url);
      handle = pdfHandle;
      newspaperPdfHandle = pdfHandle;
      // Replace the loading placeholder with the PDF element.
      scrollEl.replaceChildren(pdfHandle.element);
    });
  }

  function renderNewspaper(s: AppState): void {
    const papers = s.newspapers;
    if (!papers.length) {
      clear(newspaperPanel);
      newspaperPanel.append(h('div', { class: 'empty-state', text: 'No newspapers available for this case yet.' }));
      return;
    }
    if (!currentNewspaperUrl || !papers.find((p) => p.image_url === currentNewspaperUrl)) {
      currentNewspaperUrl = papers[0].image_url;
    }
    const paper = papers.find((p) => p.image_url === currentNewspaperUrl)!;
    buildNewspaperInlay(paper, papers);
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
    const current = selectors.currentCase(s);
    const map = current?.map_id ? s.maps.find((m) => m.id === current.map_id) : null;
    // Don't rebuild (and lose zoom/pan) if the same map is already mounted — a
    // store update from notes/clues shouldn't reset what the player is examining.
    if ((map?.id ?? null) === builtMapId && mapPanel.childElementCount > 0) return;
    builtMapId = map?.id ?? null;
    mapPanZoom?.detach();
    mapPanZoom = null;
    clear(mapPanel);
    if (!map) {
      mapPanel.append(h('div', { class: 'empty-state', text: 'No map attached to this case.' }));
      return;
    }

    const img = h('img', { class: 'player-map-img', attrs: { src: map.url, alt: map.name } });
    const viewport = h('div', { class: 'player-map-viewport' }, img);
    mapPanZoom = attachPanZoom(viewport, img);

    const ctrls = h('div', { class: 'map-ctrl-bar' },
      h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' },   on: { click: () => mapPanZoom?.reset() } }),
      h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' },      on: { click: () => mapPanZoom?.zoomOut() } }),
      h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' },       on: { click: () => mapPanZoom?.zoomIn() } }),
      h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' },   on: { click: () => openMapViewer(map.url, map.name) } }),
    );

    mapPanel.append(h('div', { class: 'player-map-inlay' }, viewport, ctrls));
  }

  function renderPanel(s: AppState): void {
    // Tear down the map's window listeners whenever we're not showing the map.
    if (activeTab !== 'map' && mapPanZoom) { mapPanZoom.detach(); mapPanZoom = null; builtMapId = null; }
    // Tear down newspaper PDF when leaving; builtNewspaperUrl resets so it rebuilds on re-enter.
    if (activeTab !== 'newspaper' && newspaperPdfHandle) { newspaperPdfHandle.destroy(); newspaperPdfHandle = null; builtNewspaperUrl = null; }
    if (activeTab === 'briefing') {
      renderBriefing(s);
      replaceChildren(panelEl, briefingPanel);
    } else if (activeTab === 'clues') {
      renderDetail(s);
      renderClues(s);
      replaceChildren(panelEl, cluesPanel);
    } else if (activeTab === 'questions') {
      renderQuestions(s);
      replaceChildren(panelEl, questionsPanel);
    } else if (activeTab === 'solution') {
      renderSolution(s);
      replaceChildren(panelEl, solutionPanel);
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
    const hasQuestions = s.questions.length > 0;
    const hasSolution = !!s.solution?.revealed && !!s.solution.content;
    if (tabButtons.map) tabButtons.map.style.display = hasMap ? '' : 'none';
    if (tabButtons.newspaper) tabButtons.newspaper.style.display = hasNews ? '' : 'none';
    if (tabButtons.questions) tabButtons.questions.style.display = hasQuestions ? '' : 'none';
    if (tabButtons.solution) tabButtons.solution.style.display = hasSolution ? '' : 'none';
    // If active tab became hidden, fall back to clues
    if ((activeTab === 'map' && !hasMap) || (activeTab === 'newspaper' && !hasNews) ||
        (activeTab === 'questions' && !hasQuestions) || (activeTab === 'solution' && !hasSolution)) {
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
      mapPanZoom?.detach();
      newspaperPdfHandle?.destroy();
    },
  };
}
