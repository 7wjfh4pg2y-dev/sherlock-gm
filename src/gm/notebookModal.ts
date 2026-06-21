// ── GM Notebook panel ──
// Read-only view (plus delete) of every player's notes, grouped into a Shared
// tab + one tab per player. Renders inline in the GM screen and exposes a
// refresh() the screen calls on store updates — it does not subscribe itself.

import { h, clear } from '../util/dom';
import { store, type AppState } from '../state/store';
import { notes as noteRepo } from '../data/supabase';
import { loadGMRightPanel } from './load';
import { createNotebook, noteCard, fillFeed, type NotebookTab } from '../components/notebook';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';

async function handleDeleteNote(id: string): Promise<void> {
  if (!(await confirmDelete('Delete this note?'))) return;
  const caseId = store.getState().currentCaseId;
  try {
    await noteRepo.remove(id);
    // DELETE realtime events don't carry case_id (default replica identity),
    // so the channel filter drops them — refresh our own view directly.
    if (caseId) await loadGMRightPanel(caseId);
  } catch { toast('Could not delete note.'); }
}

/** Builds the case notebook as a standalone element for inline embedding (a tab
 *  in the GM screen). Returns the element plus a refresh() that rebuilds only
 *  when the set of notes actually changes, so the active sub-tab is preserved. */
export function buildGMNotebook(): { element: HTMLElement; refresh(): void } {
  const element = h('div', { class: 'gm-notebook-inline' });
  let lastSig = '';

  function build(state: AppState): void {
    const sig = state.notes.map((n) => `${n.id}:${n.is_private ? 1 : 0}`).join(',');
    if (sig === lastSig && element.childElementCount) return;
    lastSig = sig;
    renderNotebookInto(element, state);
  }

  build(store.getState());
  return { element, refresh: () => build(store.getState()) };
}

/** Shared renderer: clears `target` and builds the grouped notebook into it. */
function renderNotebookInto(target: HTMLElement, state: AppState): void {
  clear(target);
  const allNotes = state.notes;
  const sharedNotes = allNotes.filter((n) => !n.is_private);
  const playerNames = [...new Set(allNotes.map((n) => n.player_name))];

  const sharedFeed = h('div', { class: 'nb-notes' });
  const sharedContent = h('div', {}, sharedFeed);

  fillFeed(sharedFeed, sharedNotes.map((n) => noteCard({
    name: n.player_name,
    color: n.player_color,
    time: n.created_at,
    text: n.content,
    actions: [{ label: '✕', danger: true, onClick: () => void handleDeleteNote(n.id) }],
  })), 'No shared notes yet.');

  const tabs: NotebookTab[] = [{ id: 'shared', label: 'Shared', content: sharedContent }];

  for (const name of playerNames) {
    const feed = h('div', { class: 'nb-notes' });
    const color = allNotes.find((n) => n.player_name === name)?.player_color ?? '#888';
    tabs.push({ id: `player-${name}`, label: name, dotColor: color, content: h('div', {}, feed) });
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

  const nb = createNotebook(tabs);
  target.append(nb.element);
}
