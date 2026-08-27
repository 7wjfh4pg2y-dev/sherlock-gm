// ── Database schema types ──
// Mirrors the Supabase tables. These are the single source of truth for shapes;
// nothing in the app should hand-type a row.

export interface CaseRow {
  id: string;
  name: string;
  description: string | null;
  brief_image_url: string | null;
  map_id: string | null;
  investigation_date: string | null;
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

// A point in normalised map coordinates (0..1 of the image's width/height).
export interface MapStrokePoint {
  x: number;
  y: number;
}

// A collaborative map marking: a freehand 'stroke' (polyline) or a 'pin'
// (single point). Carries its author so only they (or the GM) can erase it.
export interface MapStrokeRow {
  id: string;
  case_id: string;
  player_name: string;
  player_color: string;
  kind: 'stroke' | 'pin';
  points: MapStrokePoint[];
  label: string;
  created_at: string;
}

export type MapStrokeInsert = {
  case_id: string;
  player_name: string;
  player_color: string;
  kind: 'stroke' | 'pin';
  points: MapStrokePoint[];
  label?: string;
};

// ── Deduction board ──
// A shared pin-board per case. Coordinates are absolute px in a fixed logical
// board (BOARD_W/BOARD_H in components/boardInlay.ts) rather than normalised to
// an image, so an arrangement reads the same on every screen. Anyone may move a
// card; only the author (or the GM) may delete one.
export interface BoardItemRow {
  id: string;
  case_id: string;
  /** 'clue' mirrors a revealed clue; 'note' is free text the team wrote. */
  kind: 'clue' | 'note';
  /** Set when kind is 'clue' — the clue whose text the card shows. */
  clue_id: string | null;
  /** Body text for a 'note'. Empty for a 'clue' card. */
  text: string;
  x: number;
  y: number;
  player_name: string;
  player_color: string;
  created_at: string;
}

export type BoardItemInsert = {
  case_id: string;
  kind: 'clue' | 'note';
  clue_id?: string | null;
  text?: string;
  x: number;
  y: number;
  player_name: string;
  player_color: string;
};

/** String between two cards. Cascades away with either endpoint. */
export interface BoardLinkRow {
  id: string;
  case_id: string;
  from_id: string;
  to_id: string;
  /** Why these two are connected, e.g. "contradicts". Empty for a bare line. */
  label: string;
  /** Per-string colour override. Empty means "use the author's colour". */
  color: string;
  player_name: string;
  player_color: string;
  created_at: string;
}

export type BoardLinkInsert = {
  case_id: string;
  from_id: string;
  to_id: string;
  label?: string;
  color?: string;
  player_name: string;
  player_color: string;
};

// ── End-of-case questions + solution ──

// A GM-authored question. `answer` is the official answer, hidden from players
// (the client query omits it) until `revealed` is set. `points` is shown next to
// the question for both roles.
export type QuestionCategory = 'main' | 'additional';

export interface QuestionRow {
  id: string;
  case_id: string;
  prompt: string;
  answer: string;
  points: number;
  position: number;
  /** 'main' = central-mystery questions scored against Holmes;
      'additional' = secondary "other questions" about side leads. */
  category: QuestionCategory;
  /** Whether the question prompt+points are visible to players (reveal #1). */
  visible: boolean;
  /** Whether the official answer is visible to players (reveal #2). */
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
  image_url: string | null;
  revealed: boolean;
  score: number | null;
  score_revealed: boolean;
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
export type CaseInsert = { name: string; description?: string | null; ordinal?: number; investigation_date?: string | null };
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
  category?: QuestionCategory;
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
