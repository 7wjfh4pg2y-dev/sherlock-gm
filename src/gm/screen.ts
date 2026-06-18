// ── GM screen ──
// Reactive: subscribes to store; realtime (wired in enterGM) drives store.set().
// All child panels are updated via replaceChildren / fillFeed — no full re-render.

import { h, replaceChildren, clear } from '../util/dom';
import { store, selectors, type AppState } from '../state/store';
import type { ClueRow, PlayerRow, CaseRow, NewspaperRow } from '../data/types';
import {
  cases as caseRepo,
  clues as clueRepo,
  players as playerRepo,
  notes as noteRepo,
  maps as mapRepo,
  storage,
  subscribeToCase,
  watchPresence,
  removeChannel,
} from '../data/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { loadGMCase, loadGMRightPanel, loadGMClues, loadGMNewspapers, loadGMQuestions, loadGMSolution, loadGMMapStrokes } from './load';
import { gmLogout } from './auth';
import { openMapsLibrary } from './mapsLibrary';
import { openNewspaperModal } from './newspaperModal';
import { openScotlandYard } from './scotlandYard';
import { buildGMNotebook } from './notebookModal';
import { buildGMQuestionsPanel, buildGMSolutionPanel } from './questionsPanel';
import { openTitledModal } from '../components/modal';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { openMapViewer } from '../components/mapViewer';
import { buildDirectory } from '../components/directory';
import { buildInformants } from '../components/informants';
import { buildMapInlay, type MapInlayHandle } from '../components/mapInlay';
import type { InlinePdfHandle } from '../components/pdfViewer';
import { createDropdown } from '../components/dropdown';

export interface GMScreenHandle {
  element: HTMLElement;
  destroy(): void;
}

export function createGMScreen(): GMScreenHandle {
  // Realtime channels for the currently selected case.
  let caseChannels: RealtimeChannel[] = [];
  let presenceChannel: RealtimeChannel | null = null;
  let onlineSet = new Set<string>();

  // ── Top bar ──
  const caseDropdown = createDropdown({ className: 'gm-case-select', onChange: handleCaseChange });
  const scotlandYardBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '🏛 Scotland Yard',
    on: { click: () => openScotlandYard({
      onCaseCreated: async (c) => {
        store.set({ cases: [...store.getState().cases, c] });
        renderCaseSelect(store.getState());
        caseDropdown.setValue(c.id);
        await openCase(c.id);
      },
      onCaseUpdated: (c) => {
        store.set({ cases: store.getState().cases.map((x) => x.id === c.id ? c : x) });
        renderCaseSelect(store.getState());
      },
      onCaseDeleted: (id) => {
        const s = store.getState();
        store.set({ cases: s.cases.filter((c) => c.id !== id), currentCaseId: null, clues: [], players: [], notes: [] });
        teardownCase();
      },
    }) },
  });
  const mapsBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '🗺 Cartographer',
    on: { click: openMapsLibrary },
  });
  const newspaperBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '📰 Printing Press',
    on: { click: openNewspaperModal },
  });
  const logoutBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: 'Logout',
    on: { click: handleLogout },
  });
  const shareBlock = h('div', { class: 'gm-share-block' });

  // GM leads counter (revealed clues badge next to dropdown)
  const gmLeadsNum = h('span', { class: 'gm-leads-num', text: '0' });
  const gmLeadsWrap = h('div', { class: 'gm-leads-wrap' },
    h('span', { class: 'gm-leads-icon', text: '🔍' }),
    gmLeadsNum,
  );

  // ── Header: case dropdown + tool buttons + Logout ──
  const header = h('header', { class: 'gm-header' },
    h('div', { class: 'gm-title-group' },
      h('div', { class: 'gm-select-wrap' }, caseDropdown.element),
      gmLeadsWrap,
    ),
    h('div', { class: 'gm-header-actions' }, scotlandYardBtn, mapsBtn, newspaperBtn, logoutBtn),
  );

  // ── Tab bar: all case content lives in inline tabs (like the player view) ──
  type GMTab = 'clues' | 'briefing' | 'questions' | 'solution' | 'directory' | 'informants' | 'map' | 'newspaper' | 'notebook';
  let activeTab: GMTab = 'clues';
  const tabButtons: Partial<Record<GMTab, HTMLElement>> = {};
  const tabBar = h('div', { class: 'gm-tab-bar' });
  for (const { id, label } of [
    { id: 'briefing' as const, label: 'Case Brief' },
    { id: 'clues' as const, label: 'Clues' },
    { id: 'newspaper' as const, label: 'Newspaper' },
    { id: 'directory' as const, label: 'Directory' },
    { id: 'informants' as const, label: 'Informants' },
    { id: 'map' as const, label: 'Map' },
    { id: 'questions' as const, label: 'Questions' },
    { id: 'solution' as const, label: 'Solution' },
    { id: 'notebook' as const, label: 'Notebook' },
  ]) {
    const btn = h('button', {
      class: 'gm-tab-btn' + (id === activeTab ? ' active' : ''),
      text: label,
      on: { click: () => switchTab(id) },
    });
    tabButtons[id] = btn;
    tabBar.append(btn);
  }
  const tabRow = h('div', { class: 'gm-tabrow' }, tabBar);

  // ── Panels (one shown at a time in panelEl) ──
  const briefingPanel = h('div', { class: 'gm-briefing' });
  const unrevealedSection = h('div', { class: 'gm-section' });
  const revealedSection = h('div', { class: 'gm-section' });
  const cluesPanel = h('div', { class: 'gm-clues-panel' }, unrevealedSection, revealedSection);
  const directoryPanel = h('div', { class: 'gm-directory-panel' });
  const informantsPanel = h('div', { class: 'gm-informants-panel' }, buildInformants());
  const mapPanel = h('div', { class: 'gm-map-panel' });
  const newspaperPanel = h('div', { class: 'gm-newspaper-panel' });
  const gmNotebook = buildGMNotebook();
  const gmQuestions = buildGMQuestionsPanel();
  const gmSolution = buildGMSolutionPanel();
  const panelEl = h('div', { class: 'gm-panel' });

  // Map pan/zoom lifecycle (mirrors the player map tab).
  let mapInlay: MapInlayHandle | null = null;
  let builtMapId: string | null = null;
  let directoryBuilt = false;
  let builtNewspaperUrl: string | null = null;
  let currentNewspaperUrl: string | null = null;
  let newspaperPdfHandle: InlinePdfHandle | null = null;

  // ── Right panel: invite code + players ──
  const playersPanel = h('div', { class: 'gm-players-panel' });
  const rightPanel = h('div', { class: 'gm-right-panel' }, shareBlock, playersPanel);

  const empty = h('div', { class: 'empty-state', text: 'Select or create a case to begin.' });

  const element = h('div', { class: 'gm-screen' },
    header,
    tabRow,
    h('div', { class: 'gm-body' },
      h('div', { class: 'gm-main' }, panelEl),
      rightPanel,
    ),
  );

  function switchTab(id: GMTab): void {
    activeTab = id;
    for (const [tid, btn] of Object.entries(tabButtons)) btn?.classList.toggle('active', tid === id);
    renderPanel(store.getState());
  }

  // ── Case select wiring ──
  function handleCaseChange(id: string): void {
    if (!id) {
      teardownCase();
      store.set({ currentCaseId: null, clues: [], players: [], notes: [] });
      return;
    }
    void openCase(id);
  }

  // ── Mutations: clues ──
  async function handleReveal(id: string): Promise<void> {
    try {
      await clueRepo.setRevealed(id, true);
      toast('Clue revealed to players!');
    } catch { toast('Could not reveal clue.'); }
  }

  async function handleHide(id: string): Promise<void> {
    try {
      await clueRepo.setRevealed(id, false);
      toast('Clue hidden from players.');
    } catch { toast('Could not hide clue.'); }
  }

  async function handleDeleteClue(id: string): Promise<void> {
    if (!(await confirmDelete('Delete this clue?'))) return;
    const caseId = store.getState().currentCaseId;
    try {
      await clueRepo.remove(id);
      if (caseId) await loadGMClues(caseId); // DELETE events drop the case_id filter — refresh directly
    } catch { toast('Could not delete clue.'); }
  }

  const DISTRICTS = ['NW', 'WC', 'EC', 'SW', 'SE'] as const;

  function buildLocationPicker(initial = ''): { el: HTMLElement; getValue(): string } {
    // Parse an existing "NW 12" value back into parts.
    const m = initial.match(/^(NW|WC|EC|SW|SE)\s*(\d+)$/i);
    const initDistrict = m ? m[1].toUpperCase() : 'NW';
    const initNum = m ? m[2] : '';

    const districtSel = h('select', { class: 'gm-input gm-input--district' }) as HTMLSelectElement;
    for (const d of DISTRICTS) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (d === initDistrict) opt.selected = true;
      districtSel.append(opt);
    }
    const numInput = h('input', {
      class: 'gm-input gm-input--clue-num',
      attrs: { type: 'number', min: '1', max: '99', placeholder: '01', value: initNum },
    }) as HTMLInputElement;

    const el = h('div', { class: 'clue-location-picker' }, districtSel, numInput);
    return {
      el,
      getValue() {
        const n = numInput.value.trim().padStart(2, '0');
        return `${districtSel.value} ${n}`;
      },
    };
  }

  function showAddClueModal(): void {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;

    let clueType: 'text' | 'image' = 'text';

    const locationPicker = buildLocationPicker();
    const textInput = h('textarea', {
      class: 'gm-input',
      attrs: { placeholder: 'Clue text…', rows: '4' },
    }) as HTMLTextAreaElement;
    const fileLabel = h('label', { class: 'file-drop-label', text: 'Click to select image' });
    const fileInput = h('input', {
      attrs: { type: 'file', accept: 'image/*', style: 'display:none' },
    }) as HTMLInputElement;
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.[0]) fileLabel.textContent = '📄 ' + fileInput.files[0].name;
    });
    fileLabel.appendChild(fileInput);

    const imageField = h('div', { class: 'clue-type-field' }, fileLabel);
    const textField = h('div', { class: 'clue-type-field' }, textInput);
    textField.style.display = 'none';

    const textBtn = h('button', { class: 'btn btn-secondary btn-sm', text: 'Text' });
    const imgBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Image' });

    const switchType = (t: 'text' | 'image') => {
      clueType = t;
      imageField.style.display = t === 'image' ? '' : 'none';
      textField.style.display = t === 'text' ? '' : 'none';
      imgBtn.className = t === 'image' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      textBtn.className = t === 'text' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    };
    imgBtn.addEventListener('click', () => switchType('image'));
    textBtn.addEventListener('click', () => switchType('text'));

    const errEl = h('div', { class: 'form-error' });
    const addBtn = h('button', { class: 'btn btn-primary', text: 'Add to Case File' });

    const { handle: addClueHandle, body } = openTitledModal('Add Clue', {});
    body.append(
      h('div', { class: 'clue-type-toggle' }, imgBtn, textBtn),
      locationPicker.el,
      imageField,
      textField,
      errEl,
      addBtn,
    );

    addBtn.addEventListener('click', async () => {
      const location_name = locationPicker.getValue();
      if (!location_name.match(/\d/)) { errEl.textContent = 'Enter a clue number.'; return; }
      const position = store.getState().clues.length + 1;
      addBtn.textContent = 'Saving…';
      addBtn.setAttribute('disabled', '');
      try {
        if (clueType === 'text') {
          const clue_text = textInput.value.trim();
          if (!clue_text) { errEl.textContent = 'Enter the clue text.'; addBtn.textContent = 'Add to Case File'; addBtn.removeAttribute('disabled'); return; }
          await clueRepo.create({ case_id: caseId, location_name, clue_text, image_url: '', position });
        } else {
          const file = fileInput.files?.[0];
          if (!file) { errEl.textContent = 'Select an image.'; addBtn.textContent = 'Add to Case File'; addBtn.removeAttribute('disabled'); return; }
          const url = await storage.uploadImage(file);
          await clueRepo.create({ case_id: caseId, location_name, image_url: url, clue_text: '', position });
        }
        toast('Clue added!');
        addClueHandle.close();
      } catch {
        errEl.textContent = 'Could not save clue.';
        addBtn.textContent = 'Add to Case File';
        addBtn.removeAttribute('disabled');
      }
    });
  }

  function showEditClueModal(clue: ClueRow): void {
    const locationPicker = buildLocationPicker(clue.location_name);
    const textInput = h('textarea', {
      class: 'gm-input',
      attrs: { rows: '4' },
    }) as HTMLTextAreaElement;
    textInput.value = clue.clue_text ?? '';
    const errEl = h('div', { class: 'form-error' });
    const saveBtn = h('button', { class: 'btn btn-primary', text: 'Save' });

    const { handle: editClueHandle, body } = openTitledModal('Edit Clue', {});
    const fields: (HTMLElement | null)[] = [locationPicker.el];
    if (clue.clue_text) fields.push(textInput);
    if (clue.image_url) {
      fields.push(h('p', { class: 'form-hint', text: 'Image clue — only location name is editable.' }));
    }
    fields.push(errEl, saveBtn);
    body.append(...fields.filter(Boolean) as HTMLElement[]);

    saveBtn.addEventListener('click', async () => {
      const location_name = locationPicker.getValue();
      if (!location_name.match(/\d/)) { errEl.textContent = 'Enter a clue number.'; return; }
      try {
        await clueRepo.update(clue.id, {
          location_name,
          ...(clue.clue_text ? { clue_text: textInput.value.trim() } : {}),
        });
        toast('Clue updated.');
        editClueHandle.close();
      } catch {
        errEl.textContent = 'Could not save clue.';
      }
    });
  }

  // ── Mutations: players ──
  async function handleKick(player: PlayerRow): Promise<void> {
    try {
      await playerRepo.setKicked(player.id, true);
      toast('Player removed.');
    } catch { toast('Could not remove player.'); }
  }

  async function handleUnkick(player: PlayerRow): Promise<void> {
    try {
      await playerRepo.setKicked(player.id, false);
      toast('Player reinstated.');
    } catch { toast('Could not reinstate player.'); }
  }

  async function handleDeletePlayer(player: PlayerRow): Promise<void> {
    if (!(await confirmDelete(`Delete all data for "${player.player_name}"? This removes their notes and cannot be undone.`))) return;
    const caseId = store.getState().currentCaseId;
    try {
      const playerNotes = store.getState().notes.filter(
        (n) => n.player_name === player.player_name && n.player_color === player.player_color,
      );
      await Promise.all(playerNotes.map((n) => noteRepo.remove(n.id)));
      await playerRepo.remove(player.id);
      // DELETE realtime events don't carry case_id (default replica identity),
      // so the channel filter drops them — refresh our own view directly.
      if (caseId) await loadGMRightPanel(caseId);
      toast('Player data deleted.');
    } catch { toast('Could not delete player data.'); }
  }

  // ── Logout ──
  function handleLogout(): void {
    teardownCase();
    gmLogout();
    store.reset();
  }

  // ── Case open / teardown ──
  async function openCase(caseId: string): Promise<void> {
    teardownCase();
    try {
      await loadGMCase(caseId);
    } catch {
      toast('Could not load this case.');
      return;
    }

    caseChannels.push(
      subscribeToCase(caseId, {
        clues: () => void loadGMClues(caseId),
        players: () => void loadGMRightPanel(caseId),
        notes: () => void loadGMRightPanel(caseId),
        newspapers: () => void loadGMNewspapers(caseId),
        case_newspapers: () => void loadGMNewspapers(caseId),
        case_questions: () => void loadGMQuestions(caseId),
        question_answers: () => void loadGMQuestions(caseId),
        case_solutions: () => void loadGMSolution(caseId),
        map_strokes: () => void loadGMMapStrokes(caseId),
      }),
    );
    presenceChannel = watchPresence(caseId, (list) => {
      onlineSet = new Set(list.map((p) => `${p.player_name}|${p.player_color}`));
      renderPlayers(store.getState());
    });
  }

  function teardownCase(): void {
    caseChannels.forEach(removeChannel);
    caseChannels = [];
    if (presenceChannel) { removeChannel(presenceChannel); presenceChannel = null; }
    onlineSet = new Set();
  }

  // ── Rendering ──
  function renderCaseSelect(s: AppState): void {
    caseDropdown.setOptions(
      [
        { value: '', label: '— Select a Case —' },
        ...s.cases.map((c: CaseRow) => ({ value: c.id, label: c.name })),
      ],
      s.currentCaseId ?? '',
    );
    const revealedCount = selectors.revealedClues(s).length;
    gmLeadsNum.textContent = String(revealedCount);
    gmLeadsWrap.style.display = s.currentCaseId ? '' : 'none';
  }

  function renderShareBlock(s: AppState): void {
    const caseId = s.currentCaseId;
    if (!caseId) { shareBlock.style.display = 'none'; return; }
    shareBlock.style.display = '';
    const shareUrl = `${location.href.split('?')[0]}?case=${caseId}`;
    const code = caseId.split('-')[0].toUpperCase();
    replaceChildren(
      shareBlock,
      h('span', { class: 'gm-share-label', text: 'Invite code:' }),
      h('span', { class: 'gm-invite-code', text: code }),
      h('button', {
        class: 'btn btn-secondary btn-sm',
        text: 'Copy Link',
        on: { click: () => { void navigator.clipboard.writeText(shareUrl); toast('Link copied!'); } },
      }),
    );
  }

  let briefingEditing = false;

  function renderBriefing(s: AppState): void {
    const current = selectors.currentCase(s);
    if (!current) { clear(briefingPanel); briefingEditing = false; return; }

    const desc = current.description?.trim() ?? '';

    const displayView = h(
      'div',
      { class: 'briefing-display' },
      desc
        ? h('p', { class: 'briefing-text', text: desc })
        : h('span', { class: 'briefing-empty', text: 'No briefing set for this case yet.' }),
      h('button', {
        class: 'btn btn-secondary btn-sm',
        text: '✏️ Edit Briefing',
        on: { click: () => { briefingEditing = true; renderBriefing(store.getState()); } },
      }),
    );

    const textarea = h('textarea', {
      class: 'gm-input briefing-textarea',
      attrs: { rows: '12', placeholder: 'Set the scene — the crime, the setting, what investigators know at the outset…' },
    }) as HTMLTextAreaElement;
    textarea.value = desc;
    const saveBtn = h('button', {
      class: 'btn btn-primary btn-sm',
      text: 'Save',
      on: {
        click: async () => {
          try {
            await caseRepo.updateDescription(current.id, textarea.value.trim());
            store.set({ cases: s.cases.map((c) => c.id === current.id ? { ...c, description: textarea.value.trim() } : c) });
            briefingEditing = false;
            toast('Briefing saved.');
          } catch { toast('Could not save briefing.'); }
        },
      },
    });
    const cancelBtn = h('button', {
      class: 'btn btn-secondary btn-sm',
      text: 'Cancel',
      on: { click: () => { briefingEditing = false; renderBriefing(store.getState()); } },
    });
    const editView = h('div', { class: 'briefing-edit' }, textarea, h('div', { class: 'briefing-edit-row' }, saveBtn, cancelBtn));

    clear(briefingPanel);
    briefingPanel.append(briefingEditing ? editView : displayView);
  }

  function clueCard(c: ClueRow): HTMLElement {
    const thumb = c.clue_text
      ? h('div', { class: 'clue-thumb-text', text: c.clue_text })
      : h('img', { class: 'clue-thumb', attrs: { src: c.image_url, alt: c.location_name } });

    const revealed = c.revealed;
    const revealOrHide = revealed
      ? h('button', { class: 'clue-action-btn hide', text: '🚫 Hide', on: { click: (e: Event) => { e.stopPropagation(); void handleHide(c.id); } } })
      : h('button', { class: 'clue-action-btn reveal', text: '👁 Reveal', on: { click: (e: Event) => { e.stopPropagation(); void handleReveal(c.id); } } });

    return h(
      'div',
      { class: revealed ? 'clue-card revealed' : 'clue-card', on: { click: () => openGMCluePreview(c) } },
      thumb,
      h('div', { class: 'clue-label', text: c.location_name }),
      h(
        'div',
        { class: 'clue-actions' },
        revealOrHide,
        h('button', { class: 'clue-action-btn edit', text: '✏️ Edit', on: { click: (e: Event) => { e.stopPropagation(); showEditClueModal(c); } } }),
        h('button', { class: 'clue-action-btn del', text: '🗑 Delete', on: { click: (e: Event) => { e.stopPropagation(); void handleDeleteClue(c.id); } } }),
      ),
    );
  }

  function openGMCluePreview(c: ClueRow): void {
    if (!c.clue_text && c.image_url) { openMapViewer(c.image_url, c.location_name); return; }
    const { body } = openTitledModal(c.location_name, { contentClass: 'clue-expand' }); // handle not needed
    body.append(h('div', { class: 'clue-expand-text', text: c.clue_text }));
  }

  function renderClues(s: AppState): void {
    const unrevealed = selectors.hiddenClues(s);
    const revealed = selectors.revealedClues(s);

    clear(unrevealedSection);
    unrevealedSection.append(
      h('div', { class: 'clues-section-title' },
        'Unrevealed ',
        h('span', { class: 'counter-badge', text: String(unrevealed.length) }),
      ),
      h('div', { class: 'clues-grid' },
        ...unrevealed.map(clueCard),
        h('div', { class: 'clue-add-card', on: { click: showAddClueModal } },
          h('span', { class: 'clue-add-icon', text: '+' }),
          h('span', { text: 'Add Clue' }),
        ),
      ),
    );

    clear(revealedSection);
    if (revealed.length) {
      revealedSection.append(
        h('div', { class: 'clues-section-title' },
          'Revealed ',
          h('span', { class: 'counter-badge', text: String(revealed.length) }),
        ),
        h('div', { class: 'clues-grid' }, ...revealed.map(clueCard)),
      );
    }
  }

  function renderDirectory(): void {
    if (!directoryBuilt) {
      replaceChildren(directoryPanel, buildDirectory(true));
      directoryBuilt = true;
    }
  }

  function renderMap(s: AppState): void {
    const current = selectors.currentCase(s);
    const map = current?.map_id ? s.maps.find((m) => m.id === current.map_id) : null;
    // Don't rebuild (and lose zoom/pan) if the same map is already mounted.
    if ((map?.id ?? null) === builtMapId && mapPanel.childElementCount > 0) return;
    builtMapId = map?.id ?? null;
    mapInlay?.detach();
    mapInlay = null;
    clear(mapPanel);
    if (!map) {
      mapPanel.append(h('div', { class: 'empty-state', text: 'No map attached. Use Maps Library to attach one to this case.' }));
      return;
    }
    mapInlay = buildMapInlay({ map, isGM: true, author: { name: 'Game Master', color: '#e8c34a' } });
    mapPanel.append(mapInlay.element);
  }

  function buildNewspaperInlay(paper: NewspaperRow, allPapers: NewspaperRow[]): void {
    if (paper.image_url === builtNewspaperUrl && newspaperPanel.childElementCount > 0) return;
    newspaperPdfHandle?.destroy();
    newspaperPdfHandle = null;
    builtNewspaperUrl = paper.image_url;
    clear(newspaperPanel);

    if (allPapers.length > 1) {
      const strip = h('div', { class: 'newspaper-selector' });
      for (const p of allPapers) {
        strip.append(h('button', {
          class: 'newspaper-selector-btn' + (p.image_url === paper.image_url ? ' active' : ''),
          text: p.name,
          on: { click: () => { currentNewspaperUrl = p.image_url; builtNewspaperUrl = null; buildNewspaperInlay(p, allPapers); } },
        }));
      }
      newspaperPanel.append(strip);
    }

    const scrollEl = h('div', { class: 'pdf-inlay-scroll' }, h('div', { class: 'pdf-viewer-status', text: 'Loading…' }));
    let handle: InlinePdfHandle | null = null;
    const ctrls = h('div', { class: 'map-ctrl-bar' },
      h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' },  on: { click: () => handle?.reset() } }),
      h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' },     on: { click: () => handle?.zoomOut() } }),
      h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' },      on: { click: () => handle?.zoomIn() } }),
      h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' },  on: { click: () => openMapViewer(paper.image_url, paper.name) } }),
    );
    newspaperPanel.append(h('div', { class: 'player-newspaper-inlay' }, scrollEl, ctrls));

    void import('../components/pdfViewer').then((m) => {
      const pdfHandle = m.createInlinePdfViewer(paper.image_url);
      handle = pdfHandle;
      newspaperPdfHandle = pdfHandle;
      scrollEl.replaceChildren(pdfHandle.element);
    });
  }

  function renderNewspaper(s: AppState): void {
    const papers = s.newspapers;
    if (!papers.length) {
      clear(newspaperPanel);
      newspaperPanel.append(h('div', { class: 'empty-state', text: 'No newspapers enabled for this case. Use Printing Press to add some.' }));
      return;
    }
    if (!currentNewspaperUrl || !papers.find((p) => p.image_url === currentNewspaperUrl)) {
      currentNewspaperUrl = papers[0].image_url;
    }
    buildNewspaperInlay(papers.find((p) => p.image_url === currentNewspaperUrl)!, papers);
  }

  function renderPanel(s: AppState): void {
    if (!s.currentCaseId) { replaceChildren(panelEl, empty); return; }
    // Tear down the map's window listeners whenever we're not on the map tab.
    if (activeTab !== 'map' && mapInlay) { mapInlay.detach(); mapInlay = null; builtMapId = null; }
    if (activeTab !== 'newspaper' && newspaperPdfHandle) { newspaperPdfHandle.destroy(); newspaperPdfHandle = null; builtNewspaperUrl = null; }
    if (activeTab === 'briefing') {
      renderBriefing(s);
      replaceChildren(panelEl, briefingPanel);
    } else if (activeTab === 'questions') {
      gmQuestions.refresh();
      replaceChildren(panelEl, gmQuestions.element);
    } else if (activeTab === 'solution') {
      gmSolution.refresh();
      replaceChildren(panelEl, gmSolution.element);
    } else if (activeTab === 'directory') {
      renderDirectory();
      replaceChildren(panelEl, directoryPanel);
    } else if (activeTab === 'informants') {
      replaceChildren(panelEl, informantsPanel);
    } else if (activeTab === 'map') {
      renderMap(s);
      replaceChildren(panelEl, mapPanel);
    } else if (activeTab === 'newspaper') {
      renderNewspaper(s);
      replaceChildren(panelEl, newspaperPanel);
    } else if (activeTab === 'notebook') {
      gmNotebook.refresh();
      replaceChildren(panelEl, gmNotebook.element);
    } else {
      renderClues(s);
      replaceChildren(panelEl, cluesPanel);
    }
  }

  function renderPlayers(s: AppState): void {
    const active = selectors.activePlayers(s);
    const kicked = s.players.filter((p) => p.is_kicked);

    function playerRow(p: PlayerRow, isKicked: boolean): HTMLElement {
      const online = onlineSet.has(`${p.player_name}|${p.player_color}`);
      const dot = isKicked
        ? null
        : h('div', {
            class: online ? 'presence-dot online' : 'presence-dot',
            attrs: { title: online ? 'Online' : 'Offline' },
          });
      const colorDot = h('div', { class: 'player-color-dot', style: { background: p.player_color } });
      const name = h('span', { class: isKicked ? 'player-name kicked' : 'player-name', text: p.player_name });
      const actions = isKicked
        ? h('div', { class: 'player-actions' },
            h('button', { class: 'btn btn-secondary btn-sm', text: 'Reinstate', on: { click: () => void handleUnkick(p) } }),
            h('button', { class: 'btn btn-danger btn-sm', text: 'Del', on: { click: () => void handleDeletePlayer(p) } }),
          )
        : h('div', { class: 'player-actions' },
            h('button', { class: 'btn btn-danger btn-sm', text: 'Kick', on: { click: () => void handleKick(p) } }),
          );
      return h('div', { class: 'player-row' }, dot, colorDot, name, actions);
    }

    clear(playersPanel);
    playersPanel.append(
      h('div', { class: 'gm-panel-title' },
        'Players ',
        h('span', { class: 'counter-badge', text: String(active.length) }),
      ),
    );
    if (!s.players.length) {
      playersPanel.append(h('p', { class: 'empty-state', text: 'No players yet.' }));
    } else {
      playersPanel.append(...active.map((p) => playerRow(p, false)));
      if (kicked.length) {
        playersPanel.append(
          h('div', { class: 'kicked-divider', text: 'Removed' }),
          ...kicked.map((p) => playerRow(p, true)),
        );
      }
    }
  }

  function render(s: AppState): void {
    renderCaseSelect(s);
    renderShareBlock(s);
    const hasCase = !!s.currentCaseId;
    element.classList.toggle('no-case', !hasCase);
    tabRow.style.display = hasCase ? '' : 'none';
    rightPanel.style.display = hasCase ? '' : 'none';
    const current = selectors.currentCase(s);
    // The Map tab only appears when a map is attached; fall back to Clues if it
    // vanishes while selected.
    const hasMap = !!current?.map_id;
    const hasNews = s.newspapers.length > 0;
    if (tabButtons.map) tabButtons.map.style.display = hasMap ? '' : 'none';
    if (tabButtons.newspaper) tabButtons.newspaper.style.display = hasNews ? '' : 'none';
    if ((activeTab === 'map' && !hasMap) || (activeTab === 'newspaper' && !hasNews)) {
      activeTab = 'clues';
      for (const [tid, btn] of Object.entries(tabButtons)) btn?.classList.toggle('active', tid === 'clues');
    }
    renderPanel(s);
    renderPlayers(s);
  }

  // ── Init ──
  // Load the full cases list and maps on mount.
  void (async () => {
    const [caseList, mapList] = await Promise.all([caseRepo.list(), mapRepo.list()]);
    store.set({ cases: caseList, maps: mapList });
  })();

  const unsubscribe = store.subscribe(render);
  render(store.getState());

  return {
    element,
    destroy() {
      teardownCase();
      mapInlay?.detach();
      newspaperPdfHandle?.destroy();
      unsubscribe();
    },
  };
}
