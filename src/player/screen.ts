// ── Player screen ──
// Tabbed layout: left panel has tabs (Briefing / Clues / Newspaper / Directory / Map),
// right panel is always the notebook. Notes stay interactive regardless of which tab
// is open. Newspaper renders inline as PDF.js canvases — no overlay.

import { h, replaceChildren, clear, formatCaseDate } from '../util/dom';
import { renderRichText, hasImagePlaceholder, stripMarkup } from '../util/richText';
import { store, selectors, type AppState } from '../state/store';
import type { ClueRow, NoteRow, NewspaperRow, QuestionRow } from '../data/types';
import { notes as noteRepo, questionAnswers, mapStrokes as strokeRepo, players as playersRepo, boardItems as boardItemRepo, boardLinks as boardLinkRepo } from '../data/supabase';
import type { PresenceMeta } from '../data/supabase';
import { setPresenceSync, updatePresenceMeta } from './join';
import { PLAYER_COLORS } from '../data/colors';
import { createNotebook, noteCard, noteEditor, noteComposer, fillFeed } from '../components/notebook';
import { openMapViewer } from '../components/mapViewer';
import { createFullscreener, type Fullscreener } from '../util/fullscreen';
import { buildDirectory } from '../components/directory';
import { buildInformants } from '../components/informants';
import { openRulesModal } from '../components/rules';
import { buildMapInlay, type MapInlayHandle } from '../components/mapInlay';
import { buildBoardInlay, type BoardInlayHandle } from '../components/boardInlay';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { leaveCase } from './join';
import { HOLMES_SCORE, verdictFor } from '../data/scoring';

export interface ScreenHandle {
  element: HTMLElement;
  destroy(): void;
}

type TabId = 'briefing' | 'clues' | 'questions' | 'solution' | 'newspaper' | 'directory' | 'informants' | 'map' | 'board';

export function createPlayerScreen(): ScreenHandle {
  let editingId: string | null = null;
  let selectedClueId: string | null = null;
  let onlinePlayers: PresenceMeta[] = [];
  let presencePopupOpen = false;
  let editingAnswerId: string | null = null;
  let answerDraft = '';
  let activeTab: TabId = 'clues';
  let mapInlay: MapInlayHandle | null = null;
  let boardInlay: BoardInlayHandle | null = null;
  let builtMapId: string | null = null;
  let newspaperPdfHandle: { destroy(): void; zoomIn(): void; zoomOut(): void; reset(): void } | null = null;
  let newspaperFullscreen: Fullscreener | null = null;
  let builtNewspaperUrl: string | null = null;
  let currentNewspaperUrl: string | null = null;

  // ── Header (slim — title + color picker + leave) ──
  const caseTitle = h('h1', { class: 'screen-title' });
  // The title truncates with an ellipsis when it's too wide (notably on phones).
  // Tapping it surfaces the full name via a toast — no header-layout disruption.
  caseTitle.style.cursor = 'pointer';
  caseTitle.addEventListener('click', () => {
    if (caseTitle.scrollWidth > caseTitle.clientWidth) toast(caseTitle.textContent ?? '');
  });

  // Color picker popup
  let colorPopupOpen = false;
  const colorPopup = h('div', { class: 'color-popup hidden' });
  for (const { label, value } of PLAYER_COLORS) {
    const sw = h('button', {
      class: 'color-swatch',
      attrs: { type: 'button', title: label, 'aria-label': label, 'data-color': value },
    }) as HTMLButtonElement;
    sw.style.background = value;
    sw.addEventListener('click', () => void changeColor(value));
    colorPopup.append(sw);
  }

  async function changeColor(newColor: string): Promise<void> {
    const state = store.getState();
    const me = state.identity;
    const caseId = state.currentCaseId;
    if (!me || !caseId || newColor === me.color) { closeColorPopup(); return; }
    const oldColor = me.color;
    // Optimistic: update all owned strokes in the store and identity.
    const recolor = <T extends { player_name: string; player_color: string }>(rows: T[], from: string, to: string): T[] =>
      rows.map((r) => (r.player_name === me.name && r.player_color === from ? { ...r, player_color: to } : r));
    store.set({
      identity: { ...me, color: newColor },
      mapStrokes: recolor(state.mapStrokes, oldColor, newColor),
      // Team notes match ownership on the same pair, so they move too.
      notes: recolor(state.notes, oldColor, newColor),
      // Board cards and string carry the author's colour too, and canDelete
      // matches on name AND colour — miss these and a player loses the right to
      // delete their own cards the moment they change colour.
      boardItems: recolor(state.boardItems, oldColor, newColor),
      boardLinks: recolor(state.boardLinks, oldColor, newColor),
    });
    closeColorPopup();
    // Re-broadcast presence so other players see the new colour immediately.
    updatePresenceMeta({ player_name: me.name, player_color: newColor });
    try {
      await Promise.all([
        noteRepo.recolorPlayer(caseId, me.name, oldColor, newColor),
        strokeRepo.recolorPlayer(caseId, me.name, oldColor, newColor),
        boardItemRepo.recolorPlayer(caseId, me.name, oldColor, newColor),
        boardLinkRepo.recolorPlayer(caseId, me.name, oldColor, newColor),
        playersRepo.updateColor(caseId, me.name, newColor),
      ]);
    } catch {
      // Revert on failure.
      const cur = store.getState();
      store.set({
        identity: { ...cur.identity!, color: oldColor },
        mapStrokes: recolor(cur.mapStrokes, newColor, oldColor),
        notes: recolor(cur.notes, newColor, oldColor),
        boardItems: recolor(cur.boardItems, newColor, oldColor),
        boardLinks: recolor(cur.boardLinks, newColor, oldColor),
      });
      toast('Could not change colour.');
    }
  }

  function openColorPopup(): void {
    colorPopupOpen = true;
    // Mark current color selected
    const me = store.getState().identity;
    for (const sw of colorPopup.querySelectorAll<HTMLElement>('.color-swatch')) {
      sw.classList.toggle('selected', sw.dataset['color'] === me?.color);
    }
    colorPopup.classList.remove('hidden');
  }
  function closeColorPopup(): void {
    colorPopupOpen = false;
    colorPopup.classList.add('hidden');
  }

  const colorDot = h('button', {
    class: 'btn btn-secondary btn-sm color-dot-btn',
    attrs: { type: 'button', title: 'Change your colour' },
    on: { click: () => (colorPopupOpen ? closeColorPopup() : openColorPopup()) },
  });
  const colorBtnWrap = h('div', { class: 'color-btn-wrap' }, colorDot, colorPopup);

  // ── Presence indicator ──
  const presenceCount = h('span', { class: 'presence-count-label', text: '0 online' });
  const presenceList = h('div', { class: 'presence-popup hidden' });
  const presenceBtn = h('button', {
    class: 'btn btn-secondary btn-sm presence-btn',
    attrs: { type: 'button', title: 'Who\'s online' },
    on: { click: () => (presencePopupOpen ? closePresencePopup() : openPresencePopup()) },
  }, presenceCount);
  const presenceWrap = h('div', { class: 'presence-wrap' }, presenceBtn, presenceList);

  function renderPresencePopup(): void {
    const items = onlinePlayers.map((p) => {
      const dot = h('span', { class: 'presence-player-dot' });
      dot.style.background = p.player_color;
      return h('div', { class: 'presence-player-row' }, dot, h('span', { class: 'presence-player-name', text: p.player_name }));
    });
    replaceChildren(presenceList, ...(items.length ? items : [h('div', { class: 'presence-empty', text: 'No one else online' })]));
  }

  function openPresencePopup(): void {
    presencePopupOpen = true;
    renderPresencePopup();
    presenceList.classList.remove('hidden');
  }
  function closePresencePopup(): void {
    presencePopupOpen = false;
    presenceList.classList.add('hidden');
  }

  function updatePresence(list: PresenceMeta[]): void {
    onlinePlayers = list;
    presenceCount.textContent = `${list.length} online`;
    if (presencePopupOpen) renderPresencePopup();
  }


  // ── Leads counter ──
  const leadsTooltip = h('div', { class: 'leads-tooltip hidden' });
  const leadsIcon = h('span', { class: 'leads-icon', text: '🔍' });
  const leadsNum = h('span', { class: 'leads-num', text: '0' });
  const leadsWrap = h('div', { class: 'leads-wrap' },
    h('div', { class: 'leads-btn' }, leadsIcon, leadsNum),
    leadsTooltip,
  );
  leadsWrap.addEventListener('mouseenter', () => leadsTooltip.classList.remove('hidden'));
  leadsWrap.addEventListener('mouseleave', () => leadsTooltip.classList.add('hidden'));

  const rulesBtn = h('button', {
    class: 'btn btn-secondary btn-sm rules-btn',
    text: '?',
    attrs: { title: 'How to play', 'aria-label': 'How to play' },
    on: { click: () => openRulesModal() },
  });
  const leaveBtn = h('button', { class: 'btn btn-secondary btn-sm', text: 'Leave', on: { click: leaveCase } });
  const headerRight = h('div', { class: 'player-header-right' }, colorBtnWrap, presenceWrap, rulesBtn, leaveBtn);
  // Read-only investigation date line under the case name (hidden when unset).
  const caseDate = h('div', { class: 'case-date case-date-readonly' });
  const caseTitleGroup = h('div', { class: 'player-title-group' },
    h('div', { class: 'player-title-stack' },
      h('div', { class: 'player-title-row' }, caseTitle, leadsWrap),
      caseDate,
    ),
  );
  const header = h('header', { class: 'player-header' }, caseTitleGroup, headerRight);

  // ── Tab bar ──
  const TAB_DEFS: { id: TabId; label: string }[] = [
    { id: 'briefing',  label: 'Case Brief' },
    { id: 'clues',     label: 'Clues' },
    // The board sits next to the clues it is built from, not at the far end of
    // the bar: pinning a lead is a continuation of reading it.
    { id: 'board',     label: 'Board' },
    { id: 'newspaper', label: 'Newspaper' },
    { id: 'directory', label: 'Directory' },
    { id: 'informants', label: 'Informants' },
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
  let clueQuery = '';
  const clueSearchInput = h('input', {
    class: 'clue-search-input',
    attrs: { type: 'search', placeholder: '🔍  Search clues by title or content…' },
    style: { display: 'none' },
  }) as HTMLInputElement;
  clueSearchInput.addEventListener('input', () => {
    clueQuery = clueSearchInput.value;
    renderClues(store.getState());
  });
  const cluesPanel = h('div', {}, clueDetail, clueSearchInput, clueGrid);

  // ── Briefing panel ──
  const briefingPanel = h('div', { class: 'player-briefing-panel' });

  // ── Questions + Solution panels ──
  const questionsPanel = h('div', { class: 'player-questions-panel' });
  const solutionPanel = h('div', { class: 'player-solution-panel' });

  // ── Newspaper panel (inline PDF.js) ──
  const newspaperPanel = h('div', { class: 'player-newspaper-panel' });

  // ── Directory panel (inline; built once, retains search state) ──
  const directoryPanel = h('div', { class: 'player-directory-panel' });

  // ── Informants panel (inline; static reference, built once) ──
  const informantsPanel = h('div', { class: 'player-informants-panel' }, buildInformants());

  // ── Map panel (inline image + expand-to-overlay) ──
  const mapPanel = h('div', { class: 'player-map-panel' });
  const boardPanel = h('div', { class: 'player-board-panel' });

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
  // Unread indicator for the Team Notes tab: a small dot appears when another
  // player posts a shared note while you're not viewing that tab, and clears
  // when you open it. Existing notes at join are seeded as already-seen so the
  // dot only reflects notes that arrive live.
  const seenSharedIds = new Set<string>();
  const notebook = createNotebook([
    { id: 'private', label: 'My Notes', content: privateContent },
    { id: 'shared',  label: 'Team Notes', content: sharedContent },
  ], undefined, { mobileControls: true, onTabChange: () => refreshUnread(store.getState()) });
  const notebookWrap = h('aside', { class: 'player-notebook' }, notebook.element);

  function refreshUnread(s: AppState): void {
    const me = s.identity;
    const shared = selectors.sharedNotes(s);
    const mine = (n: NoteRow) => !!me && n.player_name === me.name && n.player_color === me.color;
    if (notebook.activeId() === 'shared') {
      // Viewing the team feed — everything currently there counts as seen.
      for (const n of shared) seenSharedIds.add(n.id);
      notebook.setUnread('shared', false);
      return;
    }
    // Own notes never flag; mark them seen so they don't light up later.
    for (const n of shared) if (mine(n)) seenSharedIds.add(n.id);
    const hasNew = shared.some((n) => !mine(n) && !seenSharedIds.has(n.id));
    notebook.setUnread('shared', hasNew);
  }

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

  // Persistent set of note IDs already shared this session. Never cleared so
  // re-sharing the same note shows a message instead of posting a duplicate.
  const sharedNoteIds = new Set<string>();
  // Tracks notes currently in-flight to prevent concurrent double-submit.
  const sharingNotes = new Set<string>();
  async function shareNote(note: NoteRow): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;
    if (sharedNoteIds.has(note.id)) { toast('Already shared with the team.'); return; }
    if (sharingNotes.has(note.id)) return;
    sharingNotes.add(note.id);
    const me = store.getState().identity;
    try {
      await noteRepo.create({
        case_id: caseId,
        content: note.content,
        is_private: false,
        player_name: me?.name ?? note.player_name,
        player_color: me?.color ?? note.player_color,
      });
      sharedNoteIds.add(note.id);
      toast('Shared with the team.');
    } catch { toast('Could not share note.'); }
    finally { sharingNotes.delete(note.id); }
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
    let body: HTMLElement;
    const thumbText = stripMarkup(c.clue_text);
    if (thumbText && c.image_url) {
      const img = document.createElement('img');
      img.src = c.image_url; img.className = 'clue-thumb-img';
      body = h('div', { class: 'clue-thumb-both' }, img, h('div', { class: 'revealed-card-text', text: thumbText }));
    } else if (c.image_url) {
      body = h('img', { attrs: { src: c.image_url, alt: c.location_name } });
    } else {
      body = h('div', { class: 'revealed-card-text', text: thumbText });
    }
    return h('div', {
      class: 'revealed-card' + (c.id === selectedClueId ? ' selected' : ''),
      on: { click: () => openClue(c) },
    }, body, h('div', { class: 'revealed-card-label' }, `${c.location_name} ⤢`));
  }

  function openClue(c: ClueRow): void {
    const opening = selectedClueId !== c.id;
    selectedClueId = opening ? c.id : null;
    renderDetail(store.getState());
    renderClues(store.getState());
    // On mobile, the detail panel opens above the grid but tapping a card
    // further down leaves it out of view with no obvious sign anything
    // happened — snap it into view so the clue is immediately visible.
    if (opening && window.matchMedia('(max-width: 860px)').matches) {
      clueDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    const bodyParts: (HTMLElement | Node)[] = [];
    if (c.clue_text) {
      const textEl = h('div', { class: 'clue-detail-text' });
      const imgClick = c.image_url ? () => openMapViewer(c.image_url!, c.location_name) : undefined;
      textEl.append(...renderRichText(c.clue_text, c.image_url || undefined, imgClick));
      bodyParts.push(textEl);
    }
    if (c.image_url && !(c.clue_text && hasImagePlaceholder(c.clue_text))) {
      const img = document.createElement('img');
      img.src = c.image_url; img.className = 'clue-detail-img';
      img.addEventListener('click', () => openMapViewer(c.image_url!, c.location_name));
      bodyParts.push(img);
    }
    replaceChildren(clueDetail, head, ...bodyParts);
  }

  function renderClues(s: AppState): void {
    const revealed = selectors.revealedClues(s);
    if (!revealed.length) {
      clueSearchInput.style.display = 'none';
      replaceChildren(clueGrid, h('div', { class: 'empty-state', text: 'Awaiting the Game Master to reveal clues…' }));
      return;
    }
    clueSearchInput.style.display = '';
    const q = clueQuery.trim();
    const list = q
      ? revealed.filter((c) => c.location_name.toLowerCase().includes(q.toLowerCase()) || c.clue_text.toLowerCase().includes(q.toLowerCase()))
      : revealed;
    if (q && !list.length) {
      replaceChildren(clueGrid, h('div', { class: 'empty-state', text: 'No clues match that search.' }));
    } else {
      replaceChildren(clueGrid, ...list.map(clueCard));
    }
  }

  function renderBriefing(s: AppState): void {
    const current = selectors.currentCase(s);
    const desc = current?.description?.trim();
    const briefImg = current?.brief_image_url ?? null;
    const children: Node[] = [];
    if (desc) {
      const p = h('div', { class: 'briefing-text' });
      const imgClick = briefImg ? () => openMapViewer(briefImg, (current?.name ?? '') + ' — Brief') : undefined;
      p.append(...renderRichText(desc, briefImg || undefined, imgClick));
      children.push(p);
    }
    if (briefImg && !(desc && hasImagePlaceholder(desc))) {
      const img = document.createElement('img');
      img.src = briefImg; img.className = 'briefing-img';
      img.addEventListener('click', () => openMapViewer(briefImg, (current?.name ?? '') + ' — Brief'));
      children.push(img);
    }
    if (!children.length) children.push(h('p', { class: 'empty-state', text: 'No briefing for this case yet.' }));
    replaceChildren(briefingPanel, ...children);
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
        attrs: { rows: '3', placeholder: "Type the team's answer…" },
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

  function scoreCard(score: number): HTMLElement {
    const v = verdictFor(score);
    return h('div', { class: 'player-score-card' },
      h('div', { class: 'player-score-title', text: 'The Final Reckoning' }),
      h('div', { class: 'player-score-tally' },
        h('div', { class: 'player-score-cell' },
          h('span', { class: 'player-score-num', text: String(score) }),
          h('span', { class: 'player-score-cap', text: 'Your Score' }),
        ),
        h('div', { class: 'player-score-vs', text: 'vs' }),
        h('div', { class: 'player-score-cell' },
          h('span', { class: 'player-score-num', text: String(HOLMES_SCORE) }),
          h('span', { class: 'player-score-cap', text: 'Sherlock' }),
        ),
      ),
      h('div', { class: 'player-score-verdict' },
        h('span', { class: 'player-score-verdict-title', text: v.title }),
        h('span', { class: 'player-score-verdict-line', text: v.line }),
      ),
    );
  }

  function renderSolution(s: AppState): void {
    const sol = s.solution;
    const hasContent = !!sol?.revealed && !!sol.content;
    const hasScore = !!sol?.score_revealed && sol.score !== null;
    if (!hasContent && !hasScore) {
      replaceChildren(solutionPanel, h('div', { class: 'empty-state', text: 'Sherlock has not revealed his solution yet.' }));
      return;
    }
    clear(solutionPanel);
    if (hasContent) {
      const p = h('div', { class: 'briefing-text' });
      const imgClick = sol?.image_url ? () => openMapViewer(sol!.image_url!, 'Solution') : undefined;
      p.append(...renderRichText(sol!.content, sol?.image_url || undefined, imgClick));
      solutionPanel.append(p);
    }
    if (sol?.image_url && !(hasContent && hasImagePlaceholder(sol!.content))) {
      const img = document.createElement('img');
      img.src = sol.image_url; img.className = 'briefing-img';
      img.addEventListener('click', () => openMapViewer(sol!.image_url!, 'Solution'));
      solutionPanel.append(img);
    }
    if (hasScore) solutionPanel.append(scoreCard(sol!.score!));
  }

  function buildNewspaperInlay(paper: NewspaperRow, allPapers: NewspaperRow[]): void {
    // Don't rebuild if the same paper is already displayed.
    if (paper.image_url === builtNewspaperUrl && newspaperPanel.childElementCount > 0) return;
    newspaperFullscreen?.dispose();
    newspaperFullscreen = null;
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

    const fsBtn = h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' } });
    const ctrls = h('div', { class: 'map-ctrl-bar' },
      h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' },  on: { click: () => handle?.reset() } }),
      h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' },     on: { click: () => handle?.zoomOut() } }),
      h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' },      on: { click: () => handle?.zoomIn() } }),
      fsBtn,
    );

    const inlay = h('div', { class: 'player-newspaper-inlay' }, scrollEl, ctrls);
    newspaperPanel.append(inlay);

    // Fullscreen by reparenting the existing inlay (canvases preserved) — no
    // second render, so it can't crash low-memory mobile browsers.
    newspaperFullscreen = createFullscreener(inlay, (open) => {
      fsBtn.textContent = open ? '✕' : '⤢';
      fsBtn.title = open ? 'Exit fullscreen' : 'Fullscreen';
    });
    fsBtn.addEventListener('click', () => newspaperFullscreen?.toggle());

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
    // Guard on mapInlay !== null rather than mapPanel.childElementCount: when the
    // map enters fullscreen its element is reparented out of mapPanel, so
    // childElementCount becomes 0 and a bare count check would tear down the inlay.
    if ((map?.id ?? null) === builtMapId && mapInlay !== null) return;
    builtMapId = map?.id ?? null;
    mapInlay?.detach();
    mapInlay = null;
    clear(mapPanel);
    if (!map) {
      mapPanel.append(h('div', { class: 'empty-state', text: 'No map attached to this case.' }));
      return;
    }
    const me = s.identity ?? { name: 'Player', color: '#ffd60a' };
    mapInlay = buildMapInlay({ map, isGM: false, author: me });
    mapPanel.append(mapInlay.element);
  }

  // Built once, then patched. Rebuilding on every store update would drop the
  // card you are mid-drag on, and every optimistic drag writes to the store.
  // Guard on boardInlay !== null, never on childElementCount — see renderMap.
  function renderBoard(): void {
    if (boardInlay) { boardInlay.refresh(); return; }
    const me = store.getState().identity ?? { name: 'Player', color: '#e8c34a' };
    clear(boardPanel);
    boardInlay = buildBoardInlay({ isGM: false, author: me });
    boardPanel.append(boardInlay.element);
  }

  function renderPanel(s: AppState): void {
    // Tear down the map's window listeners whenever we're not showing the map.
    if (activeTab !== 'map' && mapInlay) { mapInlay.detach(); mapInlay = null; builtMapId = null; }
    if (activeTab !== 'board' && boardInlay) { boardInlay.detach(); boardInlay = null; clear(boardPanel); }
    // Tear down newspaper PDF when leaving; builtNewspaperUrl resets so it rebuilds on re-enter.
    if (activeTab !== 'newspaper' && newspaperPdfHandle) { newspaperFullscreen?.dispose(); newspaperFullscreen = null; newspaperPdfHandle.destroy(); newspaperPdfHandle = null; builtNewspaperUrl = null; }
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
    } else if (activeTab === 'informants') {
      replaceChildren(panelEl, informantsPanel);
    } else if (activeTab === 'board') {
      renderBoard();
      replaceChildren(panelEl, boardPanel);
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
      badge: isPrivate ? 'Private' : 'Shared',
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
    const dateText = current?.investigation_date ? formatCaseDate(current.investigation_date) : '';
    caseDate.textContent = dateText;
    caseDate.style.display = dateText ? '' : 'none';
    if (s.identity) colorDot.style.background = s.identity.color;
    const leadCount = selectors.revealedClues(s).length;
    leadsNum.textContent = String(leadCount);
    leadsTooltip.textContent = `${leadCount} lead${leadCount === 1 ? '' : 's'} followed up on`;
    // Wire up presence sync once (idempotent — setPresenceSync is safe to call repeatedly).
    if (s.currentCaseId) setPresenceSync(updatePresence);
    // Show/hide tab buttons based on available content
    const hasMap = !!current?.map_id;
    const hasNews = s.newspapers.length > 0;
    const hasQuestions = s.questions.length > 0;
    const hasSolution = (!!s.solution?.revealed && !!s.solution.content)
      || (!!s.solution?.score_revealed && s.solution.score !== null);
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
    refreshUnread(s);
  }

  // Seed all shared notes present at mount as already-seen, so the unread dot
  // only ever reflects notes that arrive after the player has joined.
  for (const n of selectors.sharedNotes(store.getState())) seenSharedIds.add(n.id);

  const unsubscribe = store.subscribe(render);
  render(store.getState());

  return {
    element,
    destroy() {
      unsubscribe();
      setPresenceSync(() => {});
      mapInlay?.detach();
      boardInlay?.detach();
      newspaperFullscreen?.dispose();
      newspaperPdfHandle?.destroy();
    },
  };
}
