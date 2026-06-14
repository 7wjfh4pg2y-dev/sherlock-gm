// ── GM data loader ──
// Called when a case is selected (or re-selected after realtime events).
// Fetches all case data in parallel and pushes it into the store.

import { cases, clues, players, notes, maps, newspapers } from '../data/supabase';
import { loadDirectory } from '../data/directory';
import { store } from '../state/store';
import type { MapRow } from '../data/types';

export async function loadGMCase(caseId: string): Promise<void> {
  const [caseData, allClues, allPlayers, allNotes, allMaps, allNewspapers, enabledIds] = await Promise.all([
    cases.get(caseId),
    clues.listForCase(caseId),
    players.listForCase(caseId),
    notes.listForCase(caseId),
    maps.list(),
    newspapers.list(),
    newspapers.enabledIds(caseId),
  ]);

  const mapList: MapRow[] = allMaps;
  await loadDirectory(caseId);

  store.set({
    currentCaseId: caseId,
    cases: caseData ? [caseData, ...store.getState().cases.filter((c) => c.id !== caseId)] : store.getState().cases,
    clues: allClues,
    players: allPlayers,
    notes: allNotes,
    maps: mapList,
    newspapers: allNewspapers,
    caseNewspaperIds: enabledIds,
  });
}

/** Reload the newspaper library + which are enabled for this case. */
export async function loadGMNewspapers(caseId: string): Promise<void> {
  const [list, enabledIds] = await Promise.all([
    newspapers.list(),
    newspapers.enabledIds(caseId),
  ]);
  store.set({ newspapers: list, caseNewspaperIds: enabledIds });
}

export async function loadGMMaps(): Promise<void> {
  const allMaps = await maps.list();
  store.set({ maps: allMaps });
}

/** Reload only players + notes (used by the right-panel realtime handler). */
export async function loadGMRightPanel(caseId: string): Promise<void> {
  const [allPlayers, allNotes] = await Promise.all([
    players.listForCase(caseId),
    notes.listForCase(caseId),
  ]);
  store.set({ players: allPlayers, notes: allNotes });
}

/** Reload only clues (used by the clues realtime handler). */
export async function loadGMClues(caseId: string): Promise<void> {
  const allClues = await clues.listForCase(caseId);
  store.set({ clues: allClues });
}
