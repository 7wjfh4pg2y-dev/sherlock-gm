// ── GM screen ──
// Reactive: subscribes to store; realtime (wired in enterGM) drives store.set().
// All child panels are updated via replaceChildren / fillFeed — no full re-render.

import { h, replaceChildren, clear, formatCaseDate } from '../util/dom';
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
import { createFullscreener, type Fullscreener } from '../util/fullscreen';
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

  // ── Investigation date (small read-only line under the case name) ──
  // The in-world date is set in the Scotland Yard create/edit form; this just
  // displays it (hidden when unset). Players see the same line.
  const caseDate = h('div', { class: 'case-date case-date-readonly' });

  function renderCaseDate(s: AppState): void {
    const current = selectors.currentCase(s);
    const text = current?.investigation_date ? formatCaseDate(current.investigation_date) : '';
    caseDate.textContent = text;
    caseDate.style.display = text ? '' : 'none';
  }

  // ── Header: case dropdown + tool buttons + Logout ──
  const header = h('header', { class: 'gm-header' },
    h('div', { class: 'gm-title-group' },
      h('div', { class: 'gm-title-stack' },
        h('div', { class: 'gm-title-row' },
          h('div', { class: 'gm-select-wrap' }, caseDropdown.element),
          gmLeadsWrap,
        ),
        caseDate,
      ),
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
  const searchSection = h('div', { class: 'gm-section' });
  // Stable search input — NOT rebuilt on store updates so the GM never loses
  // focus/cursor position while typing mid-search.
  let clueQuery = '';
  const clueSearchInput = h('input', {
    class: 'clue-search-input',
    attrs: { type: 'search', placeholder: '🔍  Search clues by title or content…' },
  }) as HTMLInputElement;
  clueSearchInput.addEventListener('input', () => {
    clueQuery = clueSearchInput.value;
    renderClues(store.getState());
  });
  searchSection.append(clueSearchInput);
  const cluesPanel = h('div', { class: 'gm-clues-panel' }, searchSection, unrevealedSection, revealedSection);
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
  let newspaperFullscreen: Fullscreener | null = null;

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

    const locationPicker = buildLocationPicker();
    const textInput = h('textarea', {
      class: 'gm-input',
      attrs: { placeholder: 'Clue text… (optional if adding an image)', rows: '5' },
    }) as HTMLTextAreaElement;

    const fileLabel = h('label', { class: 'file-drop-label', text: 'Click to attach an image (optional)' });
    const fileInput = h('input', {
      attrs: { type: 'file', accept: 'image/*', style: 'display:none' },
    }) as HTMLInputElement;
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.[0]) fileLabel.textContent = '📷 ' + fileInput.files[0].name;
    });
    fileLabel.appendChild(fileInput);

    const errEl = h('div', { class: 'form-error' });
    const addBtn = h('button', { class: 'btn btn-primary', text: 'Add to Case File' });

    const { handle: addClueHandle, body } = openTitledModal('Add Clue', {});
    body.append(locationPicker.el, textInput, fileLabel, errEl, addBtn);

    addBtn.addEventListener('click', async () => {
      const location_name = locationPicker.getValue();
      if (!location_name.match(/\d/)) { errEl.textContent = 'Enter a clue number.'; return; }
      const clue_text = textInput.value.trim();
      const file = fileInput.files?.[0];
      if (!clue_text && !file) { errEl.textContent = 'Enter clue text or attach an image.'; return; }
      const position = store.getState().clues.length + 1;
      addBtn.textContent = 'Saving…';
      addBtn.setAttribute('disabled', '');
      try {
        const image_url = file ? await storage.uploadImage(file) : '';
        await clueRepo.create({ case_id: caseId, location_name, clue_text, image_url, position });
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
      class: 'gm-input clue-edit-textarea',
      attrs: { rows: '10', placeholder: 'Clue text… (optional if image is present)' },
    }) as HTMLTextAreaElement;
    textInput.value = clue.clue_text ?? '';

    // Current image preview + replace/remove controls
    let pendingImageFile: File | null = null;
    let removeImage = false;
    const imageSection = document.createElement('div');
    imageSection.className = 'clue-edit-image-section';
    const renderImageSection = (): void => {
      imageSection.innerHTML = '';
      if (clue.image_url && !removeImage) {
        const preview = document.createElement('img');
        preview.src = clue.image_url; preview.className = 'clue-edit-img-preview';
        const removeBtn = h('button', { class: 'btn btn-danger btn-sm', text: '✕ Remove image',
          on: { click: () => { removeImage = true; pendingImageFile = null; renderImageSection(); } } });
        imageSection.append(preview, removeBtn);
      } else if (pendingImageFile) {
        const name = h('p', { class: 'form-hint', text: '📷 ' + pendingImageFile.name });
        const clearBtn = h('button', { class: 'btn btn-secondary btn-sm', text: '✕ Clear',
          on: { click: () => { pendingImageFile = null; removeImage = false; renderImageSection(); } } });
        imageSection.append(name, clearBtn);
      } else {
        const fileLabel = h('label', { class: 'file-drop-label', text: clue.image_url ? 'Click to replace image' : 'Click to attach an image (optional)' });
        const fileInput = h('input', { attrs: { type: 'file', accept: 'image/*', style: 'display:none' } }) as HTMLInputElement;
        fileInput.addEventListener('change', () => {
          if (fileInput.files?.[0]) { pendingImageFile = fileInput.files[0]; removeImage = false; renderImageSection(); }
        });
        fileLabel.appendChild(fileInput);
        imageSection.append(fileLabel);
      }
    };
    renderImageSection();

    const errEl = h('div', { class: 'form-error' });
    const saveBtn = h('button', { class: 'btn btn-primary', text: 'Save' });

    const { handle: editClueHandle, body } = openTitledModal('Edit Clue', { contentClass: 'clue-edit-modal' });
    body.append(locationPicker.el, textInput, imageSection, errEl, saveBtn);

    saveBtn.addEventListener('click', async () => {
      const location_name = locationPicker.getValue();
      if (!location_name.match(/\d/)) { errEl.textContent = 'Enter a clue number.'; return; }
      const clue_text = textInput.value.trim();
      saveBtn.setAttribute('disabled', ''); saveBtn.textContent = 'Saving…';
      try {
        let image_url = clue.image_url;
        if (removeImage) image_url = '';
        if (pendingImageFile) image_url = await storage.uploadImage(pendingImageFile);
        await clueRepo.update(clue.id, { location_name, clue_text, image_url });
        toast('Clue updated.');
        editClueHandle.close();
      } catch {
        errEl.textContent = 'Could not save clue.';
        saveBtn.removeAttribute('disabled'); saveBtn.textContent = 'Save';
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
    const sortedCases = [...s.cases].sort((a, b) => {
      const ao = a.ordinal ?? 0, bo = b.ordinal ?? 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
    caseDropdown.setOptions(
      [
        { value: '', label: '— Select a Case —' },
        ...sortedCases.map((c: CaseRow) => ({ value: c.id, label: c.name })),
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
    const briefImg = current.brief_image_url ?? null;

    const displayChildren: HTMLElement[] = [];
    if (desc) displayChildren.push(h('p', { class: 'briefing-text', text: desc }));
    if (briefImg) {
      const img = document.createElement('img');
      img.src = briefImg; img.className = 'briefing-img';
      img.addEventListener('click', () => openMapViewer(briefImg, current.name + ' — Brief'));
      displayChildren.push(img);
    }
    if (!desc && !briefImg) displayChildren.push(h('span', { class: 'briefing-empty', text: 'No briefing set for this case yet.' }));

    const displayView = h('div', { class: 'briefing-display' },
      ...displayChildren,
      h('button', {
        class: 'btn btn-secondary btn-sm',
        text: '✏️ Edit Briefing',
        on: { click: () => { briefingEditing = true; renderBriefing(store.getState()); } },
      }),
    );

    // Edit view: text textarea + image management
    let pendingBriefFile: File | null = null;
    let removeBriefImage = false;
    const briefImageSection = document.createElement('div');
    briefImageSection.className = 'clue-edit-image-section';
    const renderBriefImageSection = (): void => {
      briefImageSection.innerHTML = '';
      if (briefImg && !removeBriefImage) {
        const preview = document.createElement('img');
        preview.src = briefImg; preview.className = 'clue-edit-img-preview';
        const removeBtn = h('button', { class: 'btn btn-danger btn-sm', text: '✕ Remove image',
          on: { click: () => { removeBriefImage = true; pendingBriefFile = null; renderBriefImageSection(); } } });
        briefImageSection.append(preview, removeBtn);
      } else if (pendingBriefFile) {
        const name = h('p', { class: 'form-hint', text: '📷 ' + pendingBriefFile.name });
        const clearBtn = h('button', { class: 'btn btn-secondary btn-sm', text: '✕ Clear',
          on: { click: () => { pendingBriefFile = null; removeBriefImage = false; renderBriefImageSection(); } } });
        briefImageSection.append(name, clearBtn);
      } else {
        const fileLabel = h('label', { class: 'file-drop-label', text: briefImg ? 'Click to replace image' : 'Click to attach an image (optional)' });
        const fileInput = h('input', { attrs: { type: 'file', accept: 'image/*', style: 'display:none' } }) as HTMLInputElement;
        fileInput.addEventListener('change', () => {
          if (fileInput.files?.[0]) { pendingBriefFile = fileInput.files[0]; removeBriefImage = false; renderBriefImageSection(); }
        });
        fileLabel.appendChild(fileInput);
        briefImageSection.append(fileLabel);
      }
    };
    renderBriefImageSection();

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
          saveBtn.setAttribute('disabled', '');
          try {
            let newImgUrl: string | null = briefImg;
            if (removeBriefImage) newImgUrl = null;
            if (pendingBriefFile) newImgUrl = await storage.uploadImage(pendingBriefFile);
            await caseRepo.updateDescription(current.id, textarea.value.trim());
            await caseRepo.updateBriefImage(current.id, newImgUrl);
            store.set({ cases: s.cases.map((c) => c.id === current.id ? { ...c, description: textarea.value.trim(), brief_image_url: newImgUrl } : c) });
            briefingEditing = false;
            toast('Briefing saved.');
          } catch { toast('Could not save briefing.'); saveBtn.removeAttribute('disabled'); }
        },
      },
    });
    const cancelBtn = h('button', {
      class: 'btn btn-secondary btn-sm',
      text: 'Cancel',
      on: { click: () => { briefingEditing = false; renderBriefing(store.getState()); } },
    });
    const editView = h('div', { class: 'briefing-edit' }, textarea, briefImageSection, h('div', { class: 'briefing-edit-row' }, saveBtn, cancelBtn));

    clear(briefingPanel);
    briefingPanel.append(briefingEditing ? editView : displayView);
  }

  function clueCard(c: ClueRow): HTMLElement {
    let thumb: HTMLElement;
    if (c.clue_text && c.image_url) {
      const img = document.createElement('img');
      img.src = c.image_url; img.className = 'clue-thumb-img';
      thumb = h('div', { class: 'clue-thumb-both' }, img, h('div', { class: 'clue-thumb-text', text: c.clue_text }));
    } else if (c.image_url) {
      thumb = h('img', { class: 'clue-thumb', attrs: { src: c.image_url, alt: c.location_name } });
    } else {
      thumb = h('div', { class: 'clue-thumb-text', text: c.clue_text });
    }

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
    const { body } = openTitledModal(c.location_name, { contentClass: 'clue-expand' });
    if (c.clue_text) body.append(h('div', { class: 'clue-expand-text', text: c.clue_text }));
    if (c.image_url) {
      const img = document.createElement('img');
      img.src = c.image_url; img.className = 'clue-expand-img';
      img.addEventListener('click', () => openMapViewer(c.image_url!, c.location_name));
      body.append(img);
    }
  }

  function clueMatchesQuery(c: ClueRow, q: string): boolean {
    const norm = q.toLowerCase();
    return c.location_name.toLowerCase().includes(norm) || c.clue_text.toLowerCase().includes(norm);
  }

  function renderClues(s: AppState): void {
    const unrevealed = selectors.hiddenClues(s);
    const revealed = selectors.revealedClues(s);
    const q = clueQuery.trim();

    if (q) {
      // Search mode: flatten into a single section, no Add Clue card.
      const matches = [...unrevealed, ...revealed].filter((c) => clueMatchesQuery(c, q));
      clear(unrevealedSection);
      clear(revealedSection);
      unrevealedSection.append(
        h('div', { class: 'clues-section-title' },
          `Matching clues `,
          h('span', { class: 'counter-badge', text: String(matches.length) }),
        ),
        matches.length
          ? h('div', { class: 'clues-grid' }, ...matches.map(clueCard))
          : h('div', { class: 'empty-state', text: 'No clues match that search.' }),
      );
      return;
    }

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
    if ((map?.id ?? null) === builtMapId && mapInlay !== null) return;
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
    newspaperFullscreen?.dispose();
    newspaperFullscreen = null;
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
    const fsBtn = h('button', { class: 'map-ctrl-btn', text: '⤢', attrs: { title: 'Fullscreen' } });
    const ctrls = h('div', { class: 'map-ctrl-bar' },
      h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' },  on: { click: () => handle?.reset() } }),
      h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' },     on: { click: () => handle?.zoomOut() } }),
      h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' },      on: { click: () => handle?.zoomIn() } }),
      fsBtn,
    );
    const inlay = h('div', { class: 'player-newspaper-inlay' }, scrollEl, ctrls);
    newspaperPanel.append(inlay);

    // Fullscreen by reparenting the inlay — no second render (memory-safe).
    newspaperFullscreen = createFullscreener(inlay, (open) => {
      fsBtn.textContent = open ? '✕' : '⤢';
      fsBtn.title = open ? 'Exit fullscreen' : 'Fullscreen';
    });
    fsBtn.addEventListener('click', () => newspaperFullscreen?.toggle());

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
    if (activeTab !== 'newspaper' && newspaperPdfHandle) { newspaperFullscreen?.dispose(); newspaperFullscreen = null; newspaperPdfHandle.destroy(); newspaperPdfHandle = null; builtNewspaperUrl = null; }
    if (activeTab === 'briefing') {
      // While editing, skip the rebuild so a realtime store update (e.g. a player
      // note) doesn't wipe unsaved textarea text — the persistent briefingPanel
      // keeps the edit DOM. Mirrors buildGMSolutionPanel's `if (editing) return`.
      if (!briefingEditing) renderBriefing(s);
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
    renderCaseDate(s);
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
      newspaperFullscreen?.dispose();
      newspaperPdfHandle?.destroy();
      unsubscribe();
    },
  };
}
