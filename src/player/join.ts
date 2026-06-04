// ── Player join ──
// Resolves the case, registers the player, seeds the store, and wires realtime.
// After this, the screen renders purely from store updates.

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MapRow } from '../data/types';
import {
  cases, players, clues, notes, maps, newspapers,
  subscribeToCase, trackPresence, removeChannel,
} from '../data/supabase';
import { loadDirectory } from '../data/directory';
import { store } from '../state/store';
import { nameToColor } from '../data/colors';

let channels: RealtimeChannel[] = [];

export interface JoinResult {
  ok: boolean;
  error?: string;
}

export async function joinCase(rawName: string, caseId: string): Promise<JoinResult> {
  const name = rawName.trim();
  if (!name) return { ok: false, error: 'Enter your name.' };

  const caseData = await cases.get(caseId);
  if (!caseData) return { ok: false, error: 'Case not found.' };
  if (await players.kickedState(caseId, name)) {
    return { ok: false, error: 'You have been removed from this case by the Game Master.' };
  }

  const color = nameToColor(name);
  await players.join({ case_id: caseId, player_name: name, player_color: color });

  const mapList: MapRow[] = [];
  if (caseData.map_id) {
    const m = await maps.get(caseData.map_id);
    if (m) mapList.push(m);
  }

  await loadDirectory(caseId);
  const [revealed, allNotes, allNewspapers] = await Promise.all([
    clues.listRevealed(caseId),
    notes.listForCase(caseId),
    newspapers.listForCase(caseId),
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
    players: [],
  });

  // Realtime is the only thing that updates the store after this point.
  channels.push(
    subscribeToCase(caseId, {
      clues: () => void clues.listRevealed(caseId).then((c) => store.set({ clues: c })),
      notes: () => void notes.listForCase(caseId).then((n) => store.set({ notes: n })),
      newspapers: () => void newspapers.listForCase(caseId).then((p) => store.set({ newspapers: p })),
      players: () =>
        void players.kickedState(caseId, name).then((kicked) => {
          if (kicked) leaveCase();
        }),
    }),
  );
  channels.push(trackPresence(caseId, { player_name: name, player_color: color }));

  return { ok: true };
}

export function leaveCase(): void {
  channels.forEach(removeChannel);
  channels = [];
  store.reset();
}
