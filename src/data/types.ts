// ── Database schema types ──
// Mirrors the Supabase tables. These are the single source of truth for shapes;
// nothing in the app should hand-type a row.

export interface CaseRow {
  id: string;
  name: string;
  description: string | null;
  map_id: string | null;
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

// ── Insert payloads (server fills id/created_at/defaults) ──
export type CaseInsert = { name: string; description?: string | null };
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
