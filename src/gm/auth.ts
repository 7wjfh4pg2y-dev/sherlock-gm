// ── GM auth ──
// Session-only password stored in localStorage. Not a security boundary —
// the Supabase RLS is open. This just keeps the GM controls off the landing.

const GM_PASSWORD_KEY = 'sherlock_gm_password';
const GM_SESSION_KEY = 'sherlock_gm_session';

export function isGMSessionActive(): boolean {
  return !!localStorage.getItem(GM_SESSION_KEY);
}

/** Try to log in. Returns an error string or null on success. */
export function attemptLogin(pw: string): string | null {
  if (!pw) return 'Enter a password.';
  const stored = localStorage.getItem(GM_PASSWORD_KEY);
  if (!stored) {
    // First use — set the password.
    localStorage.setItem(GM_PASSWORD_KEY, pw);
    localStorage.setItem(GM_SESSION_KEY, '1');
    return null;
  }
  if (pw !== stored) return 'Incorrect password.';
  localStorage.setItem(GM_SESSION_KEY, '1');
  return null;
}

export function gmLogout(): void {
  localStorage.removeItem(GM_SESSION_KEY);
}

export function resetGMPassword(): void {
  localStorage.removeItem(GM_PASSWORD_KEY);
  localStorage.removeItem(GM_SESSION_KEY);
}
