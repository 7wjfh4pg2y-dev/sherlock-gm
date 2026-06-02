// ── London Directory manager ──
// The 2,830-entry built-in list is a static asset fetched once and cached.
// GM edits (custom entries + hidden built-ins) are per-case overrides persisted
// as a JSON blob in storage. Not part of the realtime store: it is GM-authored
// reference data, loaded on demand, not live-synced.

import type { DirectoryEntry, DirectoryOverrides } from './types';
import { storage } from './supabase';

let builtIn: DirectoryEntry[] | null = null;
let custom: DirectoryEntry[] = [];
let hidden = new Set<string>();
let activeCaseId: string | null = null;

const SEARCH_LIMIT = 200;

/** Fetch + cache the built-in directory (once per session). */
async function ensureBuiltIn(): Promise<void> {
  if (builtIn) return;
  const res = await fetch(`${import.meta.env.BASE_URL}directory.json`);
  builtIn = (await res.json()) as DirectoryEntry[];
}

/** Load built-in data and this case's overrides. Call when a case is opened. */
export async function loadDirectory(caseId: string): Promise<void> {
  activeCaseId = caseId;
  await ensureBuiltIn();
  const overrides = await storage.loadDirectoryOverrides(caseId);
  custom = overrides?.custom ?? [];
  hidden = new Set(overrides?.hidden ?? []);
}

async function persist(): Promise<void> {
  if (!activeCaseId) return;
  const data: DirectoryOverrides = { custom, hidden: [...hidden] };
  await storage.saveDirectoryOverrides(activeCaseId, data);
}

/** Effective directory: custom entries first, then non-hidden built-ins. */
function view(): DirectoryEntry[] {
  const base = (builtIn ?? []).filter((e) => !hidden.has(e.name));
  const customNames = new Set(custom.map((e) => e.name.toLowerCase()));
  return [...custom, ...base.filter((e) => !customNames.has(e.name.toLowerCase()))];
}

export function categories(): string[] {
  const cats = view()
    .map((e) => e.category)
    .filter((c): c is string => !!c);
  return [...new Set(cats)].sort();
}

export interface SearchResult {
  entries: DirectoryEntry[];
  total: number;
  limited: boolean;
}

/** Search by name/location substring and/or category. Empty query+cat → none. */
export function search(query: string, category: string): SearchResult {
  const q = query.trim().toLowerCase();
  if (!q && !category) return { entries: [], total: 0, limited: false };

  let results = view();
  if (category) results = results.filter((e) => e.category === category);
  if (q) {
    results = results.filter(
      (e) => e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q),
    );
  }
  const total = results.length;
  return { entries: results.slice(0, SEARCH_LIMIT), total, limited: total > SEARCH_LIMIT };
}

export async function addCustomEntry(
  name: string,
  location: string,
  category: string | null,
): Promise<void> {
  custom.push({ id: `c_${Date.now()}`, name, location, category });
  await persist();
}

export async function updateCustomEntry(
  id: string,
  name: string,
  location: string,
  category: string | null,
): Promise<void> {
  const idx = custom.findIndex((e) => e.id === id);
  if (idx !== -1) custom[idx] = { id, name, location, category };
  await persist();
}

/** Remove a custom entry by id, or hide a built-in entry by name. */
export async function removeEntry(entry: DirectoryEntry): Promise<void> {
  if (entry.id) {
    custom = custom.filter((e) => e.id !== entry.id);
  } else {
    hidden.add(entry.name);
  }
  await persist();
}
