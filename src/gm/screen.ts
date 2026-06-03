// ── GM screen ──
// Reactive: subscribes to store; realtime (wired in enterGM) drives store.set().
// All child panels are updated via replaceChildren / fillFeed — no full re-render.

import { h, replaceChildren, clear } from '../util/dom';
import { store, selectors, type AppState } from '../state/store';
import type { ClueRow, NoteRow, PlayerRow, MapRow, CaseRow } from '../data/types';
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
import { loadGMCase, loadGMMaps, loadGMRightPanel, loadGMClues } from './load';
import { gmLogout, resetGMPassword } from './auth';
import { createNotebook, noteCard, fillFeed, type NotebookTab } from '../components/notebook';
import { openTitledModal } from '../components/modal';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { openMapViewer } from '../components/mapViewer';
import { openDirectoryModal } from '../components/directory';

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
  const caseSelect = h('select', { class: 'gm-case-select' });
  const newCaseBtn = h('button', {
    class: 'btn btn-primary btn-sm',
    text: '+ New Case',
    on: { click: showNewCaseModal },
  });
  const deleteCaseBtn = h('button', {
    class: 'btn btn-danger btn-sm',
    text: 'Delete Case',
    on: { click: handleDeleteCase },
  });
  const mapsBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '🗺 Maps Library',
    on: { click: showMapsLibrary },
  });
  const dirBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '📖 Directory',
    on: { click: () => openDirectoryModal(true) },
  });
  const notebookBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '📓 Notebook',
    on: { click: showNotebookModal },
  });
  const mapViewBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '🗺 Map',
    on: { click: openCaseMap },
  });
  const logoutBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: 'Logout',
    on: { click: handleLogout },
  });
  const shareBlock = h('div', { class: 'gm-share-block' });

  const topBar = h(
    'div',
    { class: 'gm-topbar' },
    h('div', { class: 'gm-case-row' }, caseSelect, newCaseBtn, deleteCaseBtn),
    h('div', { class: 'gm-toolbar' }, dirBtn, mapsBtn, mapViewBtn, notebookBtn, logoutBtn),
    shareBlock,
  );

  // ── Main area: briefing + clue grid ──
  const briefingPanel = h('div', { class: 'gm-briefing' });
  const unrevealedSection = h('div', { class: 'gm-section' });
  const revealedSection = h('div', { class: 'gm-section' });
  const mainArea = h('div', { class: 'gm-main' }, briefingPanel, unrevealedSection, revealedSection);

  // ── Right panel: players + notes badge ──
  const playersPanel = h('div', { class: 'gm-players-panel' });
  const rightPanel = h('div', { class: 'gm-right-panel' }, playersPanel);

  const empty = h('div', { class: 'empty-state', text: 'Select or create a case to begin.' });
  const content = h('div', { class: 'gm-content' }, empty);

  const element = h('div', { class: 'gm-screen' }, topBar, content);

  // ── Case select wiring ──
  caseSelect.addEventListener('change', () => {
    const id = caseSelect.value;
    if (!id) {
      teardownCase();
      store.set({ currentCaseId: null, clues: [], players: [], notes: [] });
      return;
    }
    void openCase(id);
  });

  // ── Mutations: cases ──
  function showNewCaseModal(): void {
    const nameInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'text', placeholder: 'Case name' },
    }) as HTMLInputElement;
    const descInput = h('textarea', {
      class: 'gm-input',
      attrs: { placeholder: 'Case briefing (optional)…', rows: '5' },
    }) as HTMLTextAreaElement;
    const errEl = h('div', { class: 'form-error' });
    const saveBtn = h('button', { class: 'btn btn-primary', text: 'Create Case' });
    const { handle, body } = openTitledModal('New Case', {});
    body.append(nameInput, descInput, errEl, saveBtn);
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { errEl.textContent = 'Enter a case name.'; return; }
      try {
        const c = await caseRepo.create({ name, description: descInput.value.trim() || null });
        store.set({ cases: [...store.getState().cases, c] });
        renderCaseSelect(store.getState());
        caseSelect.value = c.id;
        await openCase(c.id);
        handle.close();
      } catch {
        errEl.textContent = 'Could not create case.';
      }
    });
  }

  async function handleDeleteCase(): Promise<void> {
    const s = store.getState();
    const current = selectors.currentCase(s);
    if (!current) return;
    if (!(await confirmDelete(`Delete case "${current.name}"? All clues, players, and notes will be lost.`))) return;
    try {
      await caseRepo.remove(current.id);
      store.set({
        cases: s.cases.filter((c) => c.id !== current.id),
        currentCaseId: null,
        clues: [],
        players: [],
        notes: [],
      });
      teardownCase();
    } catch {
      toast('Could not delete case.');
    }
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

  function showAddClueModal(): void {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;

    let clueType: 'text' | 'image' = 'text';

    const locationInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'text', placeholder: 'Location name' },
    }) as HTMLInputElement;
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
      locationInput,
      imageField,
      textField,
      errEl,
      addBtn,
    );

    addBtn.addEventListener('click', async () => {
      const location_name = locationInput.value.trim();
      if (!location_name) { errEl.textContent = 'Enter a location name.'; return; }
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
    const locationInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'text', value: clue.location_name },
    }) as HTMLInputElement;
    const textInput = h('textarea', {
      class: 'gm-input',
      attrs: { rows: '4' },
    }) as HTMLTextAreaElement;
    textInput.value = clue.clue_text ?? '';
    const errEl = h('div', { class: 'form-error' });
    const saveBtn = h('button', { class: 'btn btn-primary', text: 'Save' });

    const { handle: editClueHandle, body } = openTitledModal('Edit Clue', {});
    const fields: (HTMLElement | null)[] = [locationInput];
    if (clue.clue_text) fields.push(textInput);
    if (clue.image_url) {
      fields.push(h('p', { class: 'form-hint', text: 'Image clue — only location name is editable.' }));
    }
    fields.push(errEl, saveBtn);
    body.append(...fields.filter(Boolean) as HTMLElement[]);

    saveBtn.addEventListener('click', async () => {
      const location_name = locationInput.value.trim();
      if (!location_name) { errEl.textContent = 'Enter a location name.'; return; }
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

  // ── Mutations: notes ──
  async function handleDeleteNote(id: string): Promise<void> {
    if (!(await confirmDelete('Delete this note?'))) return;
    const caseId = store.getState().currentCaseId;
    try {
      await noteRepo.remove(id);
      if (caseId) await loadGMRightPanel(caseId); // see note above re: DELETE events
    } catch { toast('Could not delete note.'); }
  }

  // ── Maps library ──
  function showMapsLibrary(): void {
    const s = store.getState();
    const currentMapId = selectors.currentCase(s)?.map_id ?? null;

    const grid = h('div', { class: 'maps-grid' });
    const nameInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'text', placeholder: 'Map name' },
    }) as HTMLInputElement;
    const fileInput = h('input', {
      attrs: { type: 'file', accept: 'image/*', style: 'display:none' },
    }) as HTMLInputElement;
    const fileLabel = h('label', { class: 'file-drop-label', text: 'Click to select image' });
    fileLabel.appendChild(fileInput);
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.[0]) fileLabel.textContent = '📄 ' + fileInput.files[0].name;
    });
    const uploadErr = h('div', { class: 'form-error' });
    const uploadBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Add Map' });

    const { body } = openTitledModal('Maps Library', { contentClass: 'maps-library-modal' }); // handle not needed; × button suffices

    function renderGrid(mapRows: MapRow[], attachedId: string | null): void {
      clear(grid);
      if (!mapRows.length) {
        grid.append(h('p', { class: 'empty-state', text: 'No maps uploaded yet.' }));
        return;
      }
      for (const m of mapRows) {
        const isAttached = !!store.getState().currentCaseId && m.id === attachedId;
        const attachBtn = !store.getState().currentCaseId
          ? h('button', { class: 'btn btn-secondary btn-sm', text: 'Use in this case', attrs: { disabled: '', title: 'Select a case first' } })
          : isAttached
          ? h('button', {
              class: 'btn btn-secondary btn-sm map-attached',
              text: '✓ In this case',
              on: { click: () => void attachMap(null, mapRows, m.id) },
            })
          : h('button', {
              class: 'btn btn-primary btn-sm',
              text: 'Use in this case',
              on: { click: () => void attachMap(m.id, mapRows, m.id) },
            });

        const renameInput = h('input', {
          class: 'gm-input map-rename-input',
          attrs: { type: 'text', value: m.name },
        }) as HTMLInputElement;
        const renameBtn = h('button', {
          class: 'btn btn-secondary btn-sm',
          text: 'Rename',
          on: {
            click: async () => {
              const name = renameInput.value.trim();
              if (!name) { toast('Enter a name first.'); return; }
              try {
                await mapRepo.rename(m.id, name);
                await loadGMMaps();
                toast('Map renamed.');
                renderGrid(store.getState().maps, store.getState().cases.find((c) => c.id === store.getState().currentCaseId)?.map_id ?? null);
              } catch { toast('Could not rename map.'); }
            },
          },
        });
        const deleteBtn = h('button', {
          class: 'btn btn-danger btn-sm',
          text: '🗑',
          on: {
            click: async () => {
              if (!(await confirmDelete('Remove this map from the library?'))) return;
              try {
                await mapRepo.remove(m.id);
                await loadGMMaps();
                toast('Map removed.');
                renderGrid(store.getState().maps, store.getState().cases.find((c) => c.id === store.getState().currentCaseId)?.map_id ?? null);
              } catch { toast('Could not delete map.'); }
            },
          },
        });

        const card = h(
          'div',
          { class: isAttached ? 'map-card map-card-attached' : 'map-card' },
          h('img', {
            class: 'map-thumb',
            attrs: { src: m.url, alt: m.name },
            on: { click: () => openMapViewer(m.url, m.name) },
          }),
          h(
            'div',
            { class: 'map-card-body' },
            attachBtn,
            renameInput,
            h('div', { class: 'map-card-actions' }, renameBtn, deleteBtn),
          ),
        );
        grid.append(card);
      }
    }

    async function attachMap(mapId: string | null, mapRows: MapRow[], _clickedId: string): Promise<void> {
      const caseId = store.getState().currentCaseId;
      if (!caseId) return;
      try {
        await caseRepo.setMap(caseId, mapId);
        // Update store cases.
        store.set({
          cases: store.getState().cases.map((c) => c.id === caseId ? { ...c, map_id: mapId } : c),
        });
        toast(mapId ? 'Map attached to case.' : 'Map detached from case.');
        renderGrid(mapRows, mapId);
      } catch { toast('Error updating map.'); }
    }

    renderGrid(s.maps, currentMapId);

    uploadBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const file = fileInput.files?.[0];
      if (!name) { uploadErr.textContent = 'Enter a map name.'; return; }
      if (!file) { uploadErr.textContent = 'Select an image.'; return; }
      uploadErr.textContent = 'Uploading…';
      uploadBtn.setAttribute('disabled', '');
      try {
        const url = await storage.uploadMapImage(file);
        await mapRepo.create({ name, url });
        await loadGMMaps();
        nameInput.value = '';
        fileInput.value = '';
        fileLabel.textContent = 'Click to select image';
        uploadErr.textContent = '';
        uploadBtn.removeAttribute('disabled');
        toast('Map added to library!');
        renderGrid(store.getState().maps, store.getState().cases.find((c) => c.id === store.getState().currentCaseId)?.map_id ?? null);
      } catch {
        uploadErr.textContent = 'Upload failed.';
        uploadBtn.removeAttribute('disabled');
      }
    });

    body.append(
      grid,
      h('div', { class: 'maps-upload-form' },
        h('h3', { class: 'form-section-title', text: 'Add New Map' }),
        nameInput,
        fileLabel,
        uploadErr,
        uploadBtn,
      ),
    );
  }

  function openCaseMap(): void {
    const s = store.getState();
    const current = selectors.currentCase(s);
    const map = current?.map_id ? s.maps.find((m) => m.id === current.map_id) : null;
    if (!map) { toast('No map attached to this case.'); return; }
    openMapViewer(map.url, map.name);
  }

  // ── GM Notebook modal ──
  function showNotebookModal(): void {
    const s = store.getState();
    const { body } = openTitledModal('Case Notebook', { contentClass: 'gm-notebook-modal' }); // handle not needed

    function buildNotebook(state: AppState): void {
      clear(body);
      const allNotes = state.notes;
      const sharedNotes = allNotes.filter((n) => !n.is_private);
      const playerNames = [...new Set(allNotes.map((n) => n.player_name))];

      const sharedFeed = h('div', { class: 'nb-notes' });
      const sharedContent = h('div', {}, sharedFeed);

      function buildShared(ns: NoteRow[]): void {
        fillFeed(sharedFeed, ns.map((n) => noteCard({
          name: n.player_name,
          color: n.player_color,
          time: n.created_at,
          text: n.content,
          actions: [{ label: '✕', danger: true, onClick: () => void handleDeleteNote(n.id) }],
        })), 'No shared notes yet.');
      }

      const tabs: NotebookTab[] = [{ id: 'shared', label: 'Shared', content: sharedContent }];

      const playerFeeds = new Map<string, HTMLElement>();
      for (const name of playerNames) {
        const feed = h('div', { class: 'nb-notes' });
        playerFeeds.set(name, feed);
        const color = allNotes.find((n) => n.player_name === name)?.player_color ?? '#888';
        tabs.push({
          id: `player-${name}`,
          label: name,
          dotColor: color,
          content: h('div', {}, feed),
        });
      }

      const nb = createNotebook(tabs);
      body.append(nb.element);

      buildShared(sharedNotes);
      for (const name of playerNames) {
        const feed = playerFeeds.get(name)!;
        const playerNotes = allNotes.filter((n) => n.player_name === name);
        fillFeed(feed, playerNotes.map((n) => noteCard({
          name: n.player_name,
          color: n.player_color,
          time: n.created_at,
          text: n.content,
          badge: n.is_private ? 'Private' : undefined,
          actions: [{ label: '✕', danger: true, onClick: () => void handleDeleteNote(n.id) }],
        })), 'No notes for this player.');
      }
    }

    buildNotebook(s);

    // Subscribe to store changes while modal is open; rebuild on notes change.
    // (Modal will unmount on close; unsub via the returned function.)
    let lastNoteCount = s.notes.length;
    const unsub = store.subscribe((state) => {
      if (state.notes.length !== lastNoteCount) {
        lastNoteCount = state.notes.length;
        buildNotebook(state);
      }
    });

    // Attach cleanup to body parent (modal close removes the element).
    const observer = new MutationObserver(() => {
      if (!body.isConnected) { unsub(); observer.disconnect(); }
    });
    if (body.parentElement) observer.observe(body.parentElement, { childList: true });
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
    await loadGMCase(caseId);

    caseChannels.push(
      subscribeToCase(caseId, {
        clues: () => void loadGMClues(caseId),
        players: () => void loadGMRightPanel(caseId),
        notes: () => void loadGMRightPanel(caseId),
      }),
    );
    presenceChannel = watchPresence(caseId, (online) => {
      onlineSet = online;
      // Force a players re-render.
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
    const caseList = s.cases;
    replaceChildren(
      caseSelect,
      h('option', { attrs: { value: '' }, text: '— Select a Case —' }),
      ...caseList.map((c: CaseRow) => {
        const opt = h('option', { attrs: { value: c.id }, text: c.name });
        if (c.id === s.currentCaseId) opt.setAttribute('selected', '');
        return opt;
      }),
    );
    deleteCaseBtn.style.display = s.currentCaseId ? '' : 'none';
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
  let briefingCollapsed = false;

  function renderBriefing(s: AppState): void {
    const current = selectors.currentCase(s);
    if (!current) { briefingPanel.style.display = 'none'; briefingEditing = false; return; }

    const desc = current.description?.trim() ?? '';

    const displayView = h(
      'div',
      { class: 'briefing-display' },
      desc
        ? h('p', { class: 'briefing-text', text: desc })
        : h('span', { class: 'briefing-empty', text: 'No briefing set.' }),
      h('button', {
        class: 'btn btn-secondary btn-sm',
        text: '✏️ Edit Briefing',
        on: { click: () => { briefingEditing = true; renderBriefing(store.getState()); } },
      }),
    );

    const textarea = h('textarea', {
      class: 'gm-input briefing-textarea',
      attrs: { rows: '8', placeholder: 'Set the scene — the crime, the setting, what investigators know at the outset…' },
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

    const toggleHeader = h('button', {
      class: 'briefing-toggle',
      on: {
        click: () => {
          briefingCollapsed = !briefingCollapsed;
          briefingPanel.classList.toggle('collapsed', briefingCollapsed);
        },
      },
    },
      h('span', { class: 'briefing-title', text: 'Case Briefing' }),
      h('span', { class: 'briefing-chevron', text: '▾' }),
    );

    clear(briefingPanel);
    briefingPanel.style.display = '';
    briefingPanel.classList.toggle('collapsed', briefingCollapsed);
    briefingPanel.append(
      toggleHeader,
      h('div', { class: 'briefing-body' }, briefingEditing ? editView : displayView),
    );
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
    if (!s.currentCaseId) {
      replaceChildren(content, empty);
      return;
    }

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

    replaceChildren(content, mainArea, rightPanel);
    // Update map view button.
    const current = selectors.currentCase(s);
    mapViewBtn.style.display = current?.map_id ? '' : 'none';
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
    renderBriefing(s);
    renderClues(s);
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
      unsubscribe();
    },
  };
}

// Re-export for main.ts convenience.
export { resetGMPassword };
