// ── Observable state store ──
// One source of truth. Components subscribe; nothing re-renders by being told to
// imperatively. Mutations write to Supabase; realtime events call the setters
// here; setters notify subscribers. That loop is the whole point of v2.

import type {
  CaseRow, ClueRow, PlayerRow, NoteRow, MapRow, NewspaperRow,
  QuestionRow, QuestionAnswerRow, SolutionRow, MapStrokeRow,
} from '../data/types';

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
  // GM: the full shared newspaper library. Player: the papers enabled for the
  // joined case (players never see the whole library).
  newspapers: NewspaperRow[];
  // GM only: ids of library newspapers enabled for the current case.
  caseNewspaperIds: string[];
  // End-of-case questions, the team's collective answers, and the solution.
  // Players only receive an answer for a revealed question, and the solution
  // only once it is revealed.
  questions: QuestionRow[];
  questionAnswers: QuestionAnswerRow[];
  solution: SolutionRow | null;
  // Collaborative markings on the case map (freehand strokes + pins).
  mapStrokes: MapStrokeRow[];
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
  newspapers: [],
  caseNewspaperIds: [],
  questions: [],
  questionAnswers: [],
  solution: null,
  mapStrokes: [],
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
      newspapers: [],
      caseNewspaperIds: [],
      questions: [],
      questionAnswers: [],
      solution: null,
      mapStrokes: [],
      identity: null,
    });
  }

  return { getState, set, subscribe, reset };
}

export const store = createStore(initialState);

// Sort clues: district alphabetically (EC < NW < SE < SW < WC), then numerically.
function sortClues(a: ClueRow, b: ClueRow): number {
  const parse = (loc: string) => {
    const m = loc.trim().match(/^([A-Z]+)\s*(\d+)$/i);
    return m ? { district: m[1].toUpperCase(), num: parseInt(m[2], 10) } : { district: loc, num: 0 };
  };
  const pa = parse(a.location_name), pb = parse(b.location_name);
  return pa.district.localeCompare(pb.district) || pa.num - pb.num;
}

// ── Derived selectors (pure; computed from current state) ──
export const selectors = {
  currentCase(s: AppState): CaseRow | null {
    return s.cases.find((c) => c.id === s.currentCaseId) ?? null;
  },
  revealedClues(s: AppState): ClueRow[] {
    return s.clues.filter((c) => c.revealed).sort(sortClues);
  },
  hiddenClues(s: AppState): ClueRow[] {
    return s.clues.filter((c) => !c.revealed).sort(sortClues);
  },
  activePlayers(s: AppState): PlayerRow[] {
    return s.players.filter((p) => !p.is_kicked);
  },
  // Newspapers enabled for the current case (GM role only — s.newspapers holds
  // the GM's full upload library, not just what's attached to this case).
  caseNewspapers(s: AppState): NewspaperRow[] {
    const enabled = new Set(s.caseNewspaperIds);
    return s.newspapers.filter((n) => enabled.has(n.id));
  },
  sharedNotes(s: AppState): NoteRow[] {
    return s.notes.filter((n) => !n.is_private);
  },
  // Player's own private notes (player role).
  ownPrivateNotes(s: AppState): NoteRow[] {
    if (!s.identity) return [];
    return s.notes.filter((n) => n.is_private && n.player_name === s.identity!.name);
  },
  // The team's collective answer to a question, if any.
  teamAnswerFor(s: AppState, questionId: string): QuestionAnswerRow | null {
    return s.questionAnswers.find((a) => a.question_id === questionId) ?? null;
  },
  totalPoints(s: AppState): number {
    return s.questions.reduce((sum, q) => sum + q.points, 0);
  },
};
