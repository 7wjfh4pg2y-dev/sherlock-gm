// ── GM auth ──
// The GM password is stored server-side in Supabase (a bcrypt hash) and checked
// via a SECURITY DEFINER RPC that returns only true/false — the hash never
// reaches the client, and the anon key can't read or change it. That is the
// security boundary the old per-device localStorage password was not: a fresh
// visitor can no longer self-register as GM. The password is set/changed only
// from the Supabase dashboard (see db/013_gm_auth.sql).
//
// `gmAuthed` (in the store) is in-memory and resets on reload, so every page
// load requires re-entering the password — there is no persisted login to forge.

import { gmAuth } from '../data/supabase';

const GM_SEEN_KEY = 'sherlock_gm_seen';

/** Whether this device has logged in as GM before. Cosmetic only — tailors the
 *  login hint; it is NOT an access grant. */
export function isGMSessionActive(): boolean {
  return !!localStorage.getItem(GM_SEEN_KEY);
}

/** Verify the GM password against the server. Returns an error string, or null
 *  on success. */
export async function attemptLogin(pw: string): Promise<string | null> {
  if (!pw) return 'Enter a password.';
  let ok: boolean;
  try {
    ok = await gmAuth.verify(pw);
  } catch {
    return 'Could not reach the server. Try again.';
  }
  if (!ok) return 'Incorrect password.';
  localStorage.setItem(GM_SEEN_KEY, '1');
  return null;
}
