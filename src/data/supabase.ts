// ── Supabase layer ──
// The ONLY module that touches the raw client. Everything else imports the
// typed repository functions / realtime helpers below.

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type {
  CaseRow, CaseInsert,
  ClueRow, ClueInsert,
  PlayerRow, PlayerInsert,
  NoteRow, NoteInsert,
  MapRow, MapInsert,
  NewspaperRow, NewspaperInsert,
  QuestionRow, QuestionInsert,
  QuestionAnswerRow, SolutionRow,
  MapStrokeRow, MapStrokeInsert, MapStrokePoint,
  BoardItemRow, BoardItemInsert, BoardLinkRow, BoardLinkInsert,
  DirectoryOverrides,
} from './types';

const SUPABASE_URL = 'https://aczebumbhhqhagtshtpm.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjemVidW1iaGhxaGFndHNodHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA0MTYsImV4cCI6MjA5NTcwNjQxNn0.3EAwEphZBq4x6b6IjGbRTa5NHdJGymiz0Lnu3875tIA';

const STORAGE_BUCKET = 'clues';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Thrown by mutations so callers can surface a toast with a real message.
export class DbError extends Error {}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new DbError(res.error.message);
  return res.data as T;
}

// ── GM auth ──
// Verifies a candidate password against the server-side bcrypt hash via a
// SECURITY DEFINER RPC (db/013). The hash never reaches the client, and the
// anon key can neither read nor change it.
export const gmAuth = {
  async verify(candidate: string): Promise<boolean> {
    const { data, error } = await sb.rpc('verify_gm_password', { candidate });
    if (error) throw new DbError(error.message);
    return data === true;
  },
};

// ── Cases ──
export const cases = {
  async list(): Promise<CaseRow[]> {
    // Chronological order (ordinal) first, then creation order as a tiebreak.
    // Falls back to created_at order if the `ordinal` column isn't present yet
    // (db/002 not run) — so existing cases still load before the migration.
    const res = await sb.from('cases').select('*').order('ordinal').order('created_at');
    if (res.error) {
      return unwrap(await sb.from('cases').select('*').order('created_at')) ?? [];
    }
    return (res.data as CaseRow[]) ?? [];
  },
  async get(id: string): Promise<CaseRow | null> {
    const rows = unwrap(await sb.from('cases').select('*').eq('id', id)) as CaseRow[] | null;
    return rows?.[0] ?? null;
  },
  async create(payload: CaseInsert): Promise<CaseRow> {
    return unwrap(await sb.from('cases').insert(payload).select().single());
  },
  async updateDescription(id: string, description: string): Promise<void> {
    unwrap(await sb.from('cases').update({ description }).eq('id', id).select());
  },
  async updateBriefImage(id: string, brief_image_url: string | null): Promise<void> {
    unwrap(await sb.from('cases').update({ brief_image_url }).eq('id', id).select());
  },
  async setMap(id: string, mapId: string | null): Promise<void> {
    unwrap(await sb.from('cases').update({ map_id: mapId }).eq('id', id).select());
  },
  async updateFields(id: string, patch: { name: string; description: string | null; ordinal: number; investigation_date?: string | null }): Promise<CaseRow> {
    return unwrap(await sb.from('cases').update(patch).eq('id', id).select().single());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('cases').delete().eq('id', id).select());
  },
};

// ── Clues ──
export const clues = {
  async listForCase(caseId: string): Promise<ClueRow[]> {
    return unwrap(
      await sb.from('clues').select('*').eq('case_id', caseId).order('position'),
    ) ?? [];
  },
  // Players only ever fetch revealed clues — RLS is open, so filtering here
  // prevents unrevealed clue text reaching the client at all.
  async listRevealed(caseId: string): Promise<ClueRow[]> {
    return unwrap(
      await sb.from('clues').select('*').eq('case_id', caseId).eq('revealed', true).order('position'),
    ) ?? [];
  },
  async create(payload: ClueInsert): Promise<ClueRow> {
    return unwrap(await sb.from('clues').insert(payload).select().single());
  },
  async setRevealed(id: string, revealed: boolean): Promise<void> {
    unwrap(await sb.from('clues').update({ revealed }).eq('id', id).select());
  },
  async update(id: string, patch: Partial<Pick<ClueRow, 'location_name' | 'clue_text' | 'image_url'>>): Promise<void> {
    unwrap(await sb.from('clues').update(patch).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('clues').delete().eq('id', id).select());
  },
};

// ── Players ──
export const players = {
  async listForCase(caseId: string): Promise<PlayerRow[]> {
    return unwrap(
      await sb.from('players').select('*').eq('case_id', caseId).order('joined_at'),
    ) ?? [];
  },
  async create(payload: PlayerInsert): Promise<PlayerRow> {
    return unwrap(await sb.from('players').insert(payload).select().single());
  },
  // Rejoin-safe: one row per (case_id, player_name); clears any kick on rejoin.
  async join(payload: PlayerInsert): Promise<PlayerRow> {
    return unwrap(
      await sb
        .from('players')
        .upsert({ ...payload, is_kicked: false }, { onConflict: 'case_id,player_name' })
        .select()
        .single(),
    );
  },
  async kickedState(caseId: string, playerName: string): Promise<boolean> {
    const rows = unwrap(
      await sb.from('players').select('is_kicked').eq('case_id', caseId).eq('player_name', playerName),
    ) as { is_kicked: boolean }[] | null;
    return !!rows?.[0]?.is_kicked;
  },
  async setKicked(id: string, isKicked: boolean): Promise<void> {
    unwrap(await sb.from('players').update({ is_kicked: isKicked }).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('players').delete().eq('id', id).select());
  },
  async updateColor(caseId: string, playerName: string, color: string): Promise<void> {
    unwrap(
      await sb.from('players').update({ player_color: color })
        .eq('case_id', caseId).eq('player_name', playerName).select(),
    );
  },
};

// ── Notes ──
export const notes = {
  async listForCase(caseId: string): Promise<NoteRow[]> {
    return unwrap(
      await sb.from('notes').select('*').eq('case_id', caseId).order('created_at'),
    ) ?? [];
  },
  async create(payload: NoteInsert): Promise<NoteRow> {
    return unwrap(await sb.from('notes').insert(payload).select().single());
  },
  async updateContent(id: string, content: string): Promise<void> {
    unwrap(await sb.from('notes').update({ content }).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('notes').delete().eq('id', id).select());
  },
};

// ── Maps ──
export const maps = {
  async list(): Promise<MapRow[]> {
    return unwrap(await sb.from('maps').select('*').order('created_at')) ?? [];
  },
  async get(id: string): Promise<MapRow | null> {
    const rows = unwrap(await sb.from('maps').select('*').eq('id', id)) as MapRow[] | null;
    return rows?.[0] ?? null;
  },
  async create(payload: MapInsert): Promise<MapRow> {
    return unwrap(await sb.from('maps').insert(payload).select().single());
  },
  async rename(id: string, name: string): Promise<void> {
    unwrap(await sb.from('maps').update({ name }).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('maps').delete().eq('id', id).select());
  },
};

// ── Newspapers ──
// A shared, case-independent library (like maps). Papers are enabled for cases
// via the case_newspapers join table. Always visible to players (no reveal).
export const newspapers = {
  // Reads degrade to [] on error (e.g. db/003 not run yet) so a newspaper hiccup
  // never blocks the rest of a case from loading. Mutations still throw.
  /** The full library (GM). */
  async list(): Promise<NewspaperRow[]> {
    const res = await sb.from('newspapers').select('*').order('position').order('created_at');
    if (res.error) return [];
    return (res.data as NewspaperRow[]) ?? [];
  },
  /** Papers enabled for a case (player view + GM display), in library order. */
  async listForCase(caseId: string): Promise<NewspaperRow[]> {
    const res = await sb.from('case_newspapers').select('newspapers(*)').eq('case_id', caseId);
    if (res.error) return [];
    const rows = res.data as unknown as { newspapers: NewspaperRow | null }[] | null;
    return (rows ?? [])
      .map((r) => r.newspapers)
      .filter((p): p is NewspaperRow => !!p)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  },
  /** Just the enabled newspaper ids for a case (GM library toggles). */
  async enabledIds(caseId: string): Promise<string[]> {
    const res = await sb.from('case_newspapers').select('newspaper_id').eq('case_id', caseId);
    if (res.error) return [];
    const rows = res.data as { newspaper_id: string }[] | null;
    return (rows ?? []).map((r) => r.newspaper_id);
  },
  async enable(caseId: string, newspaperId: string): Promise<void> {
    unwrap(await sb.from('case_newspapers').insert({ case_id: caseId, newspaper_id: newspaperId }).select());
  },
  async disable(caseId: string, newspaperId: string): Promise<void> {
    unwrap(await sb.from('case_newspapers').delete().eq('case_id', caseId).eq('newspaper_id', newspaperId).select());
  },
  async create(payload: NewspaperInsert): Promise<NewspaperRow> {
    return unwrap(await sb.from('newspapers').insert(payload).select().single());
  },
  async rename(id: string, name: string): Promise<void> {
    unwrap(await sb.from('newspapers').update({ name }).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('newspapers').delete().eq('id', id).select());
  },
};

// ── Questions ──
// GM-authored end-of-case questions. Reads degrade to [] / null on error (e.g.
// db/004 not run yet) so a missing table never blocks the rest of a case.
// Mutations still throw so the GM sees a real failure.
export const questions = {
  /** GM view: every column, including the hidden official answer. */
  async listForCase(caseId: string): Promise<QuestionRow[]> {
    const res = await sb.from('case_questions').select('*').eq('case_id', caseId).order('position').order('created_at');
    if (res.error) return [];
    return (res.data as QuestionRow[]) ?? [];
  },
  /** Player view: only visible questions; omit `answer` until revealed. */
  async listForCasePlayer(caseId: string): Promise<QuestionRow[]> {
    const base = await sb
      .from('case_questions')
      .select('id,case_id,prompt,points,position,category,visible,revealed,created_at')
      .eq('case_id', caseId)
      .eq('visible', true)
      .order('position')
      .order('created_at');
    if (base.error) return [];
    const rows = (base.data as Omit<QuestionRow, 'answer'>[]) ?? [];
    const rev = await sb.from('case_questions').select('id,answer').eq('case_id', caseId).eq('visible', true).eq('revealed', true);
    const answers = new Map<string, string>();
    if (!rev.error) {
      for (const r of (rev.data as { id: string; answer: string }[]) ?? []) answers.set(r.id, r.answer);
    }
    return rows.map((r) => ({ ...r, answer: answers.get(r.id) ?? '' }));
  },
  async create(payload: QuestionInsert): Promise<QuestionRow> {
    return unwrap(await sb.from('case_questions').insert(payload).select().single());
  },
  async update(id: string, patch: Partial<Pick<QuestionRow, 'prompt' | 'answer' | 'points' | 'position' | 'category'>>): Promise<void> {
    unwrap(await sb.from('case_questions').update(patch).eq('id', id).select());
  },
  async setVisible(id: string, visible: boolean): Promise<void> {
    unwrap(await sb.from('case_questions').update({ visible }).eq('id', id).select());
  },
  async setVisibleAll(caseId: string, visible: boolean): Promise<void> {
    unwrap(await sb.from('case_questions').update({ visible }).eq('case_id', caseId).select());
  },
  async setRevealed(id: string, revealed: boolean): Promise<void> {
    unwrap(await sb.from('case_questions').update({ revealed }).eq('id', id).select());
  },
  async setRevealedAll(caseId: string, revealed: boolean): Promise<void> {
    unwrap(await sb.from('case_questions').update({ revealed }).eq('case_id', caseId).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('case_questions').delete().eq('id', id).select());
  },
};

// ── Question team answers (one shared answer per question) ──
export const questionAnswers = {
  async listForCase(caseId: string): Promise<QuestionAnswerRow[]> {
    const res = await sb.from('question_answers').select('*').eq('case_id', caseId);
    if (res.error) return [];
    return (res.data as QuestionAnswerRow[]) ?? [];
  },
  async save(caseId: string, questionId: string, content: string, name: string, color: string): Promise<void> {
    unwrap(
      await sb
        .from('question_answers')
        .upsert(
          { question_id: questionId, case_id: caseId, content, updated_by: name, updated_color: color, updated_at: new Date().toISOString() },
          { onConflict: 'question_id' },
        )
        .select(),
    );
  },
  async clear(questionId: string): Promise<void> {
    unwrap(await sb.from('question_answers').delete().eq('question_id', questionId));
  },
};

// ── Solution (one per case) ──
export const solutions = {
  /** GM view: full row regardless of reveal state. */
  async getForGM(caseId: string): Promise<SolutionRow | null> {
    const res = await sb.from('case_solutions').select('*').eq('case_id', caseId);
    if (res.error) return null;
    return ((res.data as SolutionRow[]) ?? [])[0] ?? null;
  },
  /** Player view: returns a row once the solution and/or the score is revealed.
   *  Keeps the narrative off the wire until `revealed` (and the score until
   *  `score_revealed`), mirroring how unrevealed clue/answer text is withheld. */
  async getForPlayer(caseId: string): Promise<SolutionRow | null> {
    const res = await sb
      .from('case_solutions')
      .select('case_id, revealed, score, score_revealed, updated_at')
      .eq('case_id', caseId);
    if (res.error) return null;
    const meta = ((res.data as Omit<SolutionRow, 'content'>[]) ?? [])[0];
    if (!meta || (!meta.revealed && !meta.score_revealed)) return null;
    let content = '';
    let image_url: string | null = null;
    if (meta.revealed) {
      const c = await sb.from('case_solutions').select('content, image_url').eq('case_id', caseId).eq('revealed', true);
      const row = ((c.data as { content: string; image_url: string | null }[]) ?? [])[0];
      content = row?.content ?? '';
      image_url = row?.image_url ?? null;
    }
    return {
      case_id: meta.case_id,
      content,
      image_url,
      revealed: meta.revealed,
      score: meta.score_revealed ? meta.score : null,
      score_revealed: meta.score_revealed,
      updated_at: meta.updated_at,
    };
  },
  async save(caseId: string, content: string): Promise<void> {
    unwrap(
      await sb
        .from('case_solutions')
        .upsert({ case_id: caseId, content, updated_at: new Date().toISOString() }, { onConflict: 'case_id' })
        .select(),
    );
  },
  async setRevealed(caseId: string, revealed: boolean): Promise<void> {
    unwrap(
      await sb
        .from('case_solutions')
        .upsert({ case_id: caseId, revealed, updated_at: new Date().toISOString() }, { onConflict: 'case_id' })
        .select(),
    );
  },
  async saveScore(caseId: string, score: number | null): Promise<void> {
    unwrap(
      await sb
        .from('case_solutions')
        .upsert({ case_id: caseId, score, updated_at: new Date().toISOString() }, { onConflict: 'case_id' })
        .select(),
    );
  },
  async setScoreRevealed(caseId: string, scoreRevealed: boolean): Promise<void> {
    unwrap(
      await sb
        .from('case_solutions')
        .upsert({ case_id: caseId, score_revealed: scoreRevealed, updated_at: new Date().toISOString() }, { onConflict: 'case_id' })
        .select(),
    );
  },
  async saveImage(caseId: string, image_url: string | null): Promise<void> {
    unwrap(
      await sb
        .from('case_solutions')
        .upsert({ case_id: caseId, image_url, updated_at: new Date().toISOString() }, { onConflict: 'case_id' })
        .select(),
    );
  },
};

// ── Map strokes (collaborative map markings) ──
export const mapStrokes = {
  async listForCase(caseId: string): Promise<MapStrokeRow[]> {
    const res = await sb.from('map_strokes').select('*').eq('case_id', caseId).order('created_at');
    if (res.error) return [];
    return (res.data as MapStrokeRow[]) ?? [];
  },
  async create(payload: MapStrokeInsert): Promise<MapStrokeRow> {
    return unwrap(await sb.from('map_strokes').insert(payload).select().single());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('map_strokes').delete().eq('id', id).select());
  },
  async setLabel(id: string, label: string): Promise<void> {
    unwrap(await sb.from('map_strokes').update({ label }).eq('id', id).select());
  },
  async move(id: string, points: MapStrokePoint[]): Promise<void> {
    unwrap(await sb.from('map_strokes').update({ points }).eq('id', id).select());
  },
  async clearForCase(caseId: string): Promise<void> {
    unwrap(await sb.from('map_strokes').delete().eq('case_id', caseId).select());
  },
  async recolorPlayer(caseId: string, playerName: string, oldColor: string, newColor: string): Promise<void> {
    unwrap(
      await sb.from('map_strokes')
        .update({ player_color: newColor })
        .eq('case_id', caseId)
        .eq('player_name', playerName)
        .eq('player_color', oldColor)
        .select(),
    );
  },
};

// ── Storage ──
export const storage = {
  async uploadImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
    if (error) throw new DbError(error.message);
    return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  },
  async uploadMapImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `maps/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
    if (error) throw new DbError(error.message);
    return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  },
  async uploadNewspaperImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `newspapers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
    if (error) throw new DbError(error.message);
    return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  },
  // Directory per-case overrides are stored as a JSON blob in the bucket.
  async loadDirectoryOverrides(caseId: string): Promise<DirectoryOverrides | null> {
    const url = sb.storage.from(STORAGE_BUCKET).getPublicUrl(`dir-overrides/${caseId}.json`).data.publicUrl;
    try {
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (!res.ok) return null;
      const json = (await res.json()) as Partial<DirectoryOverrides>;
      return {
        custom: Array.isArray(json.custom) ? json.custom : [],
        hidden: Array.isArray(json.hidden) ? json.hidden : [],
      };
    } catch {
      return null;
    }
  },
  async saveDirectoryOverrides(caseId: string, data: DirectoryOverrides): Promise<void> {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(`dir-overrides/${caseId}.json`, blob, { upsert: true, contentType: 'application/json' });
    if (error) throw new DbError(error.message);
  },
};

// ── Deduction board ──
// Cards and the string between them. Move is a bare position update (anyone may
// move); delete is guarded in the client to the author or the GM.
export const boardItems = {
  async listForCase(caseId: string): Promise<BoardItemRow[]> {
    const res = await sb.from('board_items').select('*').eq('case_id', caseId).order('created_at');
    if (res.error) return [];
    return (res.data as BoardItemRow[]) ?? [];
  },
  async create(payload: BoardItemInsert): Promise<BoardItemRow> {
    return unwrap(await sb.from('board_items').insert(payload).select().single());
  },
  async move(id: string, x: number, y: number): Promise<void> {
    unwrap(await sb.from('board_items').update({ x, y }).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('board_items').delete().eq('id', id).select());
  },
  /** GM only: wipe the case's board. Links cascade with the items. */
  async clearForCase(caseId: string): Promise<void> {
    unwrap(await sb.from('board_items').delete().eq('case_id', caseId).select());
  },
  async recolorPlayer(caseId: string, playerName: string, oldColor: string, newColor: string): Promise<void> {
    unwrap(
      await sb.from('board_items')
        .update({ player_color: newColor })
        .eq('case_id', caseId)
        .eq('player_name', playerName)
        .eq('player_color', oldColor)
        .select(),
    );
  },
};

export const boardLinks = {
  async listForCase(caseId: string): Promise<BoardLinkRow[]> {
    const res = await sb.from('board_links').select('*').eq('case_id', caseId).order('created_at');
    if (res.error) return [];
    return (res.data as BoardLinkRow[]) ?? [];
  },
  async create(payload: BoardLinkInsert): Promise<BoardLinkRow> {
    return unwrap(await sb.from('board_links').insert(payload).select().single());
  },
  async setLabel(id: string, label: string): Promise<void> {
    unwrap(await sb.from('board_links').update({ label }).eq('id', id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await sb.from('board_links').delete().eq('id', id).select());
  },
  async recolorPlayer(caseId: string, playerName: string, oldColor: string, newColor: string): Promise<void> {
    unwrap(
      await sb.from('board_links')
        .update({ player_color: newColor })
        .eq('case_id', caseId)
        .eq('player_name', playerName)
        .eq('player_color', oldColor)
        .select(),
    );
  },
};

// ── Realtime ──
// One channel per case carrying clues/players/notes changes. Callers pass a
// single handler invoked (debounced upstream if desired) on any change to the
// named table. This is the ONLY thing that should drive store updates.
type TableName =
  | 'clues' | 'players' | 'notes' | 'newspapers' | 'case_newspapers'
  | 'case_questions' | 'question_answers' | 'case_solutions' | 'map_strokes'
  | 'board_items' | 'board_links'
  | 'cases';

// Tables with no case_id at all — subscribe to all rows.
const GLOBAL_TABLES = new Set<TableName>(['newspapers']);
// Tables filtered by id=eq.{caseId} rather than case_id.
const ID_FILTERED_TABLES = new Set<TableName>(['cases']);

export function subscribeToCase(
  caseId: string,
  handlers: Partial<Record<TableName, () => void>>,
): RealtimeChannel {
  let channel = sb.channel(`case-${caseId}`);
  (Object.keys(handlers) as TableName[]).forEach((table) => {
    const opts = GLOBAL_TABLES.has(table)
      ? { event: '*' as const, schema: 'public', table }
      : ID_FILTERED_TABLES.has(table)
        ? { event: '*' as const, schema: 'public', table, filter: `id=eq.${caseId}` }
        : { event: '*' as const, schema: 'public', table, filter: `case_id=eq.${caseId}` };
    channel = channel.on('postgres_changes', opts, () => handlers[table]?.());
  });
  channel.subscribe();
  return channel;
}

export function removeChannel(channel: RealtimeChannel | null): void {
  if (channel) sb.removeChannel(channel);
}

// ── Presence ──
// Players announce themselves on a per-case channel; the GM reads the roster to
// show who's currently online. Returns the channel so callers can remove it.
export interface PresenceMeta {
  player_name: string;
  player_color: string;
}

// Single presence channel that both tracks the local player AND notifies on
// sync events. All listeners must be added before .subscribe() — Supabase
// throws if you call .on() on an already-subscribed channel.
export function joinPresence(
  caseId: string,
  meta: PresenceMeta,
  onSync: (online: PresenceMeta[]) => void,
): RealtimeChannel {
  const channel = sb.channel(`presence-${caseId}`);
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const seen = new Map<string, PresenceMeta>();
      for (const entries of Object.values(state))
        for (const e of entries) seen.set(`${e.player_name}|${e.player_color}`, e);
      onSync([...seen.values()]);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track(meta);
    });
  return channel;
}

// GM-only watcher: does not track a player, just observes presence.
export function watchPresence(
  caseId: string,
  onSync: (online: PresenceMeta[]) => void,
): RealtimeChannel {
  const channel = sb.channel(`presence-watch-${caseId}`);
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const seen = new Map<string, PresenceMeta>();
      for (const entries of Object.values(state)) {
        for (const e of entries) seen.set(`${e.player_name}|${e.player_color}`, e);
      }
      onSync([...seen.values()]);
    })
    .subscribe();
  return channel;
}
