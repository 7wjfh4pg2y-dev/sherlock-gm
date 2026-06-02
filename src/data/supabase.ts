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

// ── Cases ──
export const cases = {
  async list(): Promise<CaseRow[]> {
    return unwrap(await sb.from('cases').select('*').order('created_at')) ?? [];
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
  async setMap(id: string, mapId: string | null): Promise<void> {
    unwrap(await sb.from('cases').update({ map_id: mapId }).eq('id', id).select());
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
  async setPrivate(id: string, isPrivate: boolean): Promise<void> {
    unwrap(await sb.from('notes').update({ is_private: isPrivate }).eq('id', id).select());
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
    const path = `maps/${Date.now()}.${ext}`;
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

// ── Realtime ──
// One channel per case carrying clues/players/notes changes. Callers pass a
// single handler invoked (debounced upstream if desired) on any change to the
// named table. This is the ONLY thing that should drive store updates.
type TableName = 'clues' | 'players' | 'notes';

export function subscribeToCase(
  caseId: string,
  handlers: Partial<Record<TableName, () => void>>,
): RealtimeChannel {
  let channel = sb.channel(`case-${caseId}`);
  (Object.keys(handlers) as TableName[]).forEach((table) => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `case_id=eq.${caseId}` },
      () => handlers[table]?.(),
    );
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

export function trackPresence(caseId: string, meta: PresenceMeta): RealtimeChannel {
  const channel = sb.channel(`presence-${caseId}`);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void channel.track(meta);
  });
  return channel;
}

export function watchPresence(
  caseId: string,
  onSync: (online: Set<string>) => void,
): RealtimeChannel {
  const channel = sb.channel(`presence-${caseId}`);
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const online = new Set<string>();
      for (const entries of Object.values(state)) {
        for (const e of entries) online.add(`${e.player_name}|${e.player_color}`);
      }
      onSync(online);
    })
    .subscribe();
  return channel;
}
