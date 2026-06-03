// ── Player screen ──
// Renders purely from the store. Subscribes once; store changes (driven by
// realtime) refresh the clue feed and notebook feeds in place — composer focus
// and the active tab survive because only feed contents are replaced.

import { h, replaceChildren } from '../util/dom';
import { store, selectors, type AppState } from '../state/store';
import type { ClueRow, NoteRow } from '../data/types';
import { notes as noteRepo } from '../data/supabase';
import { createNotebook, noteCard, noteEditor, noteComposer, fillFeed } from '../components/notebook';
import { openTitledModal } from '../components/modal';
import { openMapViewer } from '../components/mapViewer';
import { openDirectoryModal } from '../components/directory';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { leaveCase } from './join';

export interface ScreenHandle {
  element: HTMLElement;
  destroy(): void;
}

export function createPlayerScreen(): ScreenHandle {
  // Local UI state (not store): which note is being edited inline.
  let editingId: string | null = null;

  const caseTitle = h('h1', { class: 'screen-title' });
  const meta = h('div', { class: 'screen-meta' });
  const mapBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '🗺 Map',
    on: { click: openMap },
  });
  const dirBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: '📖 Directory',
    on: { click: () => openDirectoryModal(false) },
  });
  const leaveBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    text: 'Leave',
    on: { click: leaveCase },
  });
  const header = h(
    'header',
    { class: 'player-header' },
    h('div', {}, caseTitle, meta),
    h('div', { class: 'player-toolbar' }, dirBtn, mapBtn, leaveBtn),
  );

  let briefingCollapsed = false;
  const briefingBody = h('div', { class: 'briefing-body' });
  const briefingChevron = h('span', { class: 'briefing-chevron', text: '▾' });
  const briefingToggle = h(
    'button',
    {
      class: 'briefing-toggle',
      on: {
        click: () => {
          briefingCollapsed = !briefingCollapsed;
          briefing.classList.toggle('collapsed', briefingCollapsed);
        },
      },
    },
    h('span', { class: 'briefing-title', text: 'Case Briefing' }),
    briefingChevron,
  );
  const briefing = h('div', { class: 'player-briefing' }, briefingToggle, briefingBody);
  const clueFeed = h('div', { class: 'player-content' });

  // ── Notebook ──
  const privateFeed = h('div', { class: 'nb-notes' });
  const sharedFeed = h('div', { class: 'nb-notes' });
  const privateContent = h(
    'div',
    {},
    noteComposer({ placeholder: 'Record your private deductions…', onSubmit: (t) => addNote(t, true) }),
    privateFeed,
  );
  const sharedContent = h(
    'div',
    {},
    noteComposer({ placeholder: 'Share your deductions with the team…', onSubmit: (t) => addNote(t, false) }),
    sharedFeed,
  );
  const notebook = createNotebook([
    { id: 'private', label: 'My Notes', content: privateContent },
    { id: 'shared', label: 'Team Notes', content: sharedContent },
  ]);
  const notebookWrap = h('aside', { class: 'player-notebook' }, notebook.element);

  const element = h('div', { class: 'player-screen' }, header, briefing, clueFeed, notebookWrap);

  // ── Mutations ──
  async function addNote(text: string, isPrivate: boolean): Promise<void> {
    const id = store.getState().currentCaseId;
    const me = store.getState().identity;
    if (!id || !me) return;
    try {
      await noteRepo.create({
        case_id: id,
        player_name: me.name,
        player_color: me.color,
        content: text,
        is_private: isPrivate,
      });
    } catch {
      toast('Could not save note.');
    }
  }

  async function shareNote(note: NoteRow): Promise<void> {
    try {
      await noteRepo.setPrivate(note.id, false);
      toast('Shared with the team.');
    } catch {
      toast('Could not share note.');
    }
  }

  async function deleteNote(note: NoteRow): Promise<void> {
    if (!(await confirmDelete('Delete this note?'))) return;
    const caseId = store.getState().currentCaseId;
    try {
      await noteRepo.remove(note.id);
      // DELETE realtime events don't carry case_id, so the channel filter drops
      // them — refresh our own notes directly so the card disappears.
      if (caseId) store.set({ notes: await noteRepo.listForCase(caseId) });
    } catch {
      toast('Could not delete note.');
    }
  }

  async function saveEdit(note: NoteRow, text: string): Promise<void> {
    editingId = null;
    try {
      await noteRepo.updateContent(note.id, text);
    } catch {
      toast('Could not save edit.');
      renderNotes(store.getState());
    }
  }

  // ── Rendering ──
  function clueCard(c: ClueRow): HTMLElement {
    const body = c.clue_text
      ? h('div', { class: 'revealed-card-text', text: c.clue_text })
      : h('img', { attrs: { src: c.image_url, alt: c.location_name } });
    return h(
      'div',
      { class: 'revealed-card', on: { click: () => openClue(c) } },
      body,
      h('div', { class: 'revealed-card-label' }, `${c.location_name} ⤢`),
    );
  }

  function openClue(c: ClueRow): void {
    if (!c.clue_text && c.image_url) {
      openMapViewer(c.image_url, c.location_name);
      return;
    }
    const { body } = openTitledModal(c.location_name, { contentClass: 'clue-expand' });
    body.append(h('div', { class: 'clue-expand-text', text: c.clue_text }));
  }

  function openMap(): void {
    const s = store.getState();
    const current = selectors.currentCase(s);
    const map = current?.map_id ? s.maps.find((m) => m.id === current.map_id) : null;
    if (!map) {
      toast('No map attached to this case.');
      return;
    }
    openMapViewer(map.url, map.name);
  }

  function ownNoteActions(note: NoteRow): ReturnType<typeof noteCard> {
    const isPrivate = note.is_private;
    return noteCard({
      name: note.player_name,
      color: note.player_color,
      time: note.created_at,
      text: note.content,
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
      return noteEditor(
        note.content,
        (text) => void saveEdit(note, text),
        () => { editingId = null; renderNotes(store.getState()); },
      );
    }
    if (mine) return ownNoteActions(note);
    return noteCard({
      name: note.player_name,
      color: note.player_color,
      time: note.created_at,
      text: note.content,
    });
  }

  function renderNotes(s: AppState): void {
    const me = s.identity;
    const priv = selectors.ownPrivateNotes(s).map((n) => noteRow(n, true));
    fillFeed(privateFeed, priv, 'No private notes yet.');
    const shared = selectors
      .sharedNotes(s)
      .map((n) => noteRow(n, !!me && n.player_name === me.name && n.player_color === me.color));
    fillFeed(sharedFeed, shared, 'No team notes yet. Be the first to record a deduction.');
  }

  function renderClues(s: AppState): void {
    const revealed = selectors.revealedClues(s);
    meta.textContent = revealed.length
      ? `${revealed.length} clue${revealed.length === 1 ? '' : 's'} gathered thus far`
      : '';
    if (!revealed.length) {
      replaceChildren(clueFeed, h('div', { class: 'empty-state', text: 'Awaiting the Game Master to reveal clues…' }));
      return;
    }
    replaceChildren(clueFeed, ...revealed.map(clueCard));
  }

  function renderChrome(s: AppState): void {
    const current = selectors.currentCase(s);
    caseTitle.textContent = current?.name ?? '';
    const desc = current?.description?.trim();
    if (desc) {
      replaceChildren(briefingBody, h('p', { class: 'briefing-text', text: desc }));
      briefing.hidden = false;
    } else {
      briefing.hidden = true;
    }
    mapBtn.style.display = current?.map_id ? '' : 'none';
  }

  function render(s: AppState): void {
    renderChrome(s);
    renderClues(s);
    renderNotes(s);
  }

  const unsubscribe = store.subscribe(render);
  render(store.getState());

  return {
    element,
    destroy() {
      unsubscribe();
    },
  };
}
