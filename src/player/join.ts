// ── Player join ──
// Resolves the case, registers the player, seeds the store, and wires realtime.
// After this, the screen renders purely from store updates.

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MapRow } from '../data/types';
import type { PresenceMeta } from '../data/supabase';
import {
  cases, players, clues, notes, maps, newspapers,
  questions, questionAnswers, solutions, mapStrokes, boardItems, boardLinks,
  subscribeToCase, joinPresence, removeChannel,
} from '../data/supabase';
import { loadDirectory } from '../data/directory';
import { store } from '../state/store';
import { nameToColor } from '../data/colors';

let channels: RealtimeChannel[] = [];
let presenceChannel: RealtimeChannel | null = null;
// Mutable sync callback — updated by the player screen once mounted.
let presenceSyncCb: (list: PresenceMeta[]) => void = () => {};
export function setPresenceSync(cb: (list: PresenceMeta[]) => void): void {
  presenceSyncCb = cb;
}
/** Re-broadcast presence meta (e.g. after a colour change). */
export function updatePresenceMeta(meta: PresenceMeta): void {
  void presenceChannel?.track(meta);
}

export interface JoinResult {
  ok: boolean;
  error?: string;
}

export async function joinCase(rawName: string, caseId: string, chosenColor?: string): Promise<JoinResult> {
  const name = rawName.trim();
  if (!name) return { ok: false, error: 'Enter your name.' };

  const caseData = await cases.get(caseId);
  if (!caseData) return { ok: false, error: 'Case not found.' };
  if (await players.kickedState(caseId, name)) {
    return { ok: false, error: 'You have been removed from this case by the Game Master.' };
  }

  // Ownership of a note, a map mark or a board card is matched on the author's
  // name AND colour. Someone rejoining therefore has to come back as the same
  // pair, or they silently lose the right to touch their own things — so an
  // untouched picker adopts the colour this name is already playing under.
  const existing = await players.colorFor(caseId, name);
  const color = chosenColor ?? existing ?? nameToColor(name);
  await players.join({ case_id: caseId, player_name: name, player_color: color });
  // Deliberately rejoining under a NEW colour is allowed, but everything the
  // player made has to follow them across, exactly as an in-case colour change
  // does — otherwise it is orphaned in the old colour.
  if (existing && existing !== color) {
    await Promise.all([
      notes.recolorPlayer(caseId, name, existing, color),
      mapStrokes.recolorPlayer(caseId, name, existing, color),
      boardItems.recolorPlayer(caseId, name, existing, color),
      // Strings keep the look the team gave them; only their author's colour
      // moves, so they can still cut their own.
      boardLinks.keepColorThroughRecolor(caseId, name, existing, color),
    ]).catch(() => { /* best effort: joining still succeeds */ });
  }

  const mapList: MapRow[] = [];
  if (caseData.map_id) {
    const m = await maps.get(caseData.map_id);
    if (m) mapList.push(m);
  }

  // Directory data isn't needed until the Directory tab opens — load it in the
  // background so it doesn't block the case room from appearing.
  void loadDirectory(caseId);
  const [revealed, allNotes, allNewspapers, allQuestions, allAnswers, solution, strokes, bItems, bLinks] = await Promise.all([
    clues.listRevealed(caseId),
    notes.listForCase(caseId),
    newspapers.listForCase(caseId), // papers the GM enabled for this case
    questions.listForCasePlayer(caseId),
    questionAnswers.listForCase(caseId),
    solutions.getForPlayer(caseId),
    mapStrokes.listForCase(caseId),
    boardItems.listForCase(caseId),
    boardLinks.listForCase(caseId),
  ]);

  store.set({
    role: 'player',
    identity: { name, color },
    currentCaseId: caseId,
    cases: [caseData],
    clues: revealed,
    notes: allNotes,
    maps: mapList,
    newspapers: allNewspapers,
    questions: allQuestions,
    questionAnswers: allAnswers,
    solution,
    mapStrokes: strokes,
    boardItems: bItems,
    boardLinks: bLinks,
    players: [],
  });

  // Realtime is the only thing that updates the store after this point.
  channels.push(
    subscribeToCase(caseId, {
      clues: () => void clues.listRevealed(caseId).then((c) => store.set({ clues: c })),
      notes: () => void notes.listForCase(caseId).then((n) => store.set({ notes: n })),
      newspapers: () => void newspapers.listForCase(caseId).then((p) => store.set({ newspapers: p })),
      case_newspapers: () => void newspapers.listForCase(caseId).then((p) => store.set({ newspapers: p })),
      case_questions: () => void questions.listForCasePlayer(caseId).then((q) => store.set({ questions: q })),
      question_answers: () => void questionAnswers.listForCase(caseId).then((a) => store.set({ questionAnswers: a })),
      case_solutions: () => void solutions.getForPlayer(caseId).then((sol) => store.set({ solution: sol })),
      map_strokes: () => void mapStrokes.listForCase(caseId).then((m) => store.set({ mapStrokes: m })),
      board_items: () => void boardItems.listForCase(caseId).then((b) => store.set({ boardItems: b })),
      board_links: () => void boardLinks.listForCase(caseId).then((b) => store.set({ boardLinks: b })),
      cases: () => void cases.get(caseId).then(async (c) => {
        if (!c) return;
        const mapList = c.map_id ? [await maps.get(c.map_id)].filter(Boolean) as import('../data/types').MapRow[] : [];
        store.set({ cases: [c], maps: mapList });
      }),
      players: () =>
        void players.kickedState(caseId, name).then((kicked) => {
          if (kicked) leaveCase();
        }),
    }),
  );
  const presenceCh = joinPresence(
    caseId,
    { player_name: name, player_color: color },
    (list) => presenceSyncCb(list),
  );
  presenceChannel = presenceCh;
  channels.push(presenceCh);

  return { ok: true };
}

export function leaveCase(): void {
  presenceSyncCb = () => {};
  presenceChannel = null;
  channels.forEach(removeChannel);
  channels = [];
  store.reset();
}
