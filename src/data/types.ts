// ── Database schema types ──
// Mirrors the Supabase tables. These are the single source of truth for shapes;
// nothing in the app should hand-type a row.

export interface CaseRow {
  id: string;
  name: string;
  description: string | null;
  map_id: string | null;
  /** Chronological position in the campaign (1 = first mystery). Drives
      cumulative newspaper unlocking: case N unlocks papers from cases 1..N. */
  ordinal: number;
  created_at: string;
}

export interface ClueRow {
  id: string;
  case_id: string;
  location_name: string;
  clue_text: string;
  image_url: string;
  revealed: boolean;
  position: number;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  case_id: string;
  player_name: string;
  player_color: string;
  is_kicked: boolean;
  joined_at: string;
}

export interface NoteRow {
  id: string;
  case_id: string;
  player_name: string;
  player_color: string;
  content: string;
  is_private: boolean;
  created_at: string;
}

export interface MapRow {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

// ── End-of-case questions + solution ──

// A GM-authored question. `answer` is the official answer, hidden from players
// (the client query omits it) until `revealed` is set. `points` is shown next to
// the question for both roles.
export interface QuestionRow {
  id: string;
  case_id: string;
  prompt: string;
  answer: string;
  points: number;
  position: number;
  revealed: boolean;
  created_at: string;
}

// The team's single collective answer to a question (shared answer sheet).
export interface QuestionAnswerRow {
  question_id: string;
  case_id: string;
  content: string;
  updated_by: string;
  updated_color: string;
  updated_at: string;
}

// Sherlock's solution narrative for a case (one per case). Players only ever
// receive this once `revealed` is true.
export interface SolutionRow {
  case_id: string;
  content: string;
  revealed: boolean;
  updated_at: string;
}

// A newspaper is a scanned image/PDF in a shared, case-independent library
// (like maps). It's enabled for any number of cases via the case_newspapers
// join table, and is always visible to players (handed out at case start in the
// physical game, not "revealed").
export interface NewspaperRow {
  id: string;
  name: string;
  image_url: string;
  position: number;
  created_at: string;
}

// ── Insert payloads (server fills id/created_at/defaults) ──
export type CaseInsert = { name: string; description?: string | null; ordinal?: number };
export type ClueInsert = {
  case_id: string;
  location_name: string;
  clue_text: string;
  image_url: string;
  position: number;
};
export type PlayerInsert = {
  case_id: string;
  player_name: string;
  player_color: string;
};
export type NoteInsert = {
  case_id: string;
  player_name: string;
  player_color: string;
  content: string;
  is_private: boolean;
};
export type MapInsert = { name: string; url: string };
export type NewspaperInsert = { name: string; image_url: string; position?: number };
export type QuestionInsert = {
  case_id: string;
  prompt: string;
  answer: string;
  points: number;
  position: number;
};

// ── App-level (non-DB) types ──
export interface DirectoryEntry {
  name: string;
  location: string;
  category: string | null;
  /** Present only on GM-added custom entries; built-in entries have none. */
  id?: string;
}

export interface DirectoryOverrides {
  custom: DirectoryEntry[];
  hidden: string[];
}

export interface PlayerColor {
  label: string;
  value: string;
}
