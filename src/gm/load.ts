// ── GM data loader ──
// Called when a case is selected (or re-selected after realtime events).
// Fetches all case data in parallel and pushes it into the store.

import { cases, clues, players, notes, maps, newspapers, questions, questionAnswers, solutions, mapStrokes, boardItems, boardLinks } from '../data/supabase';
import { loadDirectory } from '../data/directory';
import { store } from '../state/store';
import type { MapRow } from '../data/types';

export async function loadGMCase(caseId: string): Promise<void> {
  const [caseData, allClues, allPlayers, allNotes, allMaps, allNewspapers, enabledIds, allQuestions, allAnswers, solution, strokes, bItems, bLinks] =
    await Promise.all([
      cases.get(caseId),
      clues.listForCase(caseId),
      players.listForCase(caseId),
      notes.listForCase(caseId),
      maps.list(),
      newspapers.list(),
      newspapers.enabledIds(caseId),
      questions.listForCase(caseId),
      questionAnswers.listForCase(caseId),
      solutions.getForGM(caseId),
      mapStrokes.listForCase(caseId),
      boardItems.listForCase(caseId),
      boardLinks.listForCase(caseId),
    ]);

  const mapList: MapRow[] = allMaps;
  // Directory data isn't needed until the Directory tab opens — load it in the
  // background so it doesn't block the case from appearing.
  void loadDirectory(caseId);

  store.set({
    currentCaseId: caseId,
    cases: caseData ? [caseData, ...store.getState().cases.filter((c) => c.id !== caseId)] : store.getState().cases,
    clues: allClues,
    players: allPlayers,
    notes: allNotes,
    maps: mapList,
    newspapers: allNewspapers,
    caseNewspaperIds: enabledIds,
    questions: allQuestions,
    questionAnswers: allAnswers,
    solution,
    mapStrokes: strokes,
    boardItems: bItems,
    boardLinks: bLinks,
  });
}

/** Reload the collaborative map markings (map_strokes realtime handler). */
export async function loadGMMapStrokes(caseId: string): Promise<void> {
  store.set({ mapStrokes: await mapStrokes.listForCase(caseId) });
}

/** Reload the deduction board (board_items / board_links realtime handler). */
export async function loadGMBoard(caseId: string): Promise<void> {
  const [items, links] = await Promise.all([
    boardItems.listForCase(caseId),
    boardLinks.listForCase(caseId),
  ]);
  store.set({ boardItems: items, boardLinks: links });
}

/** Reload the GM's questions + team answers (questions realtime handler). */
export async function loadGMQuestions(caseId: string): Promise<void> {
  const [allQuestions, allAnswers] = await Promise.all([
    questions.listForCase(caseId),
    questionAnswers.listForCase(caseId),
  ]);
  store.set({ questions: allQuestions, questionAnswers: allAnswers });
}

/** Reload the GM's view of the solution (solution realtime handler). */
export async function loadGMSolution(caseId: string): Promise<void> {
  store.set({ solution: await solutions.getForGM(caseId) });
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
