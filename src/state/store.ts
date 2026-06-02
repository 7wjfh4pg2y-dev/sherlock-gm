// ── Observable state store ──
// One source of truth. Components subscribe; nothing re-renders by being told to
// imperatively. Mutations write to Supabase; realtime events call the setters
// here; setters notify subscribers. That loop is the whole point of v2.

import type { CaseRow, ClueRow, PlayerRow, NoteRow, MapRow } from '../data/types';

export type Role = 'landing' | 'gm' | 'player';

export interface Identity {
  name: string;
  color: string;
}

export interface AppState {
  role: Role;
  // GM auth (session-only; not a security boundary — see V2_PROGRESS notes).
  gmAuthed: boolean;
  // Case library (GM) + the active case shared by both roles.
  cases: CaseRow[];
  currentCaseId: string | null;
  // Per-case live data.
  clues: ClueRow[];
  players: PlayerRow[];
  notes: NoteRow[];
  maps: MapRow[];
  // Player identity (player role only).
  identity: Identity | null;
}

const initialState: AppState = {
  role: 'landing',
  gmAuthed: false,
  cases: [],
  currentCaseId: null,
  clues: [],
  players: [],
  notes: [],
  maps: [],
  identity: null,
};

type Listener = (state: AppState) => void;

function createStore(initial: AppState) {
  let state = initial;
  const listeners = new Set<Listener>();

  function getState(): Readonly<AppState> {
    return state;
  }

  /** Merge a partial patch and notify subscribers. */
  function set(patch: Partial<AppState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }

  /** Subscribe; returns an unsubscribe function. */
  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Reset to landing (e.g. on leave/logout), preserving the case library. */
  function reset(): void {
    set({
      role: 'landing',
      currentCaseId: null,
      clues: [],
      players: [],
      notes: [],
      identity: null,
    });
  }

  return { getState, set, subscribe, reset };
}

export const store = createStore(initialState);

// ── Derived selectors (pure; computed from current state) ──
export const selectors = {
  currentCase(s: AppState): CaseRow | null {
    return s.cases.find((c) => c.id === s.currentCaseId) ?? null;
  },
  revealedClues(s: AppState): ClueRow[] {
    return s.clues.filter((c) => c.revealed);
  },
  hiddenClues(s: AppState): ClueRow[] {
    return s.clues.filter((c) => !c.revealed);
  },
  activePlayers(s: AppState): PlayerRow[] {
    return s.players.filter((p) => !p.is_kicked);
  },
  sharedNotes(s: AppState): NoteRow[] {
    return s.notes.filter((n) => !n.is_private);
  },
  // Player's own private notes (player role).
  ownPrivateNotes(s: AppState): NoteRow[] {
    if (!s.identity) return [];
    return s.notes.filter((n) => n.is_private && n.player_name === s.identity!.name);
  },
  // All notes for one player (GM per-player tab): private + shared.
  notesForPlayer(s: AppState, playerName: string): NoteRow[] {
    return s.notes.filter((n) => n.player_name === playerName);
  },
};
