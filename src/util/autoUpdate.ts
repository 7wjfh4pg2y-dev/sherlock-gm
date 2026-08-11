// ── Silent auto-update ──
// A static deploy leaves already-open tabs running the old cached bundle until
// someone hard-refreshes. This polls a build marker (dist/version.json, emitted
// per build) whenever the tab regains focus and on a slow interval; when the
// deployed build id differs from the one this tab booted with, it reloads so GM
// and players always end up on the latest version without manual refreshing.
//
// Two safeguards: it never reloads while the user is actively typing (so an
// in-progress note or answer isn't lost), and it records the build it's
// reloading toward so a bundle that can't be fetched yet can't cause a reload
// loop.

declare const __BUILD_ID__: string;

const CURRENT = __BUILD_ID__;
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;
const POLL_MS = 5 * 60 * 1000;
const PENDING_KEY = 'sh-autoupdate-pending';

let reloading = false;

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable;
}

function readPending(): string | null {
  try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; }
}
function writePending(id: string | null): void {
  try {
    if (id === null) sessionStorage.removeItem(PENDING_KEY);
    else sessionStorage.setItem(PENDING_KEY, id);
  } catch { /* private mode — best effort */ }
}

async function checkForUpdate(): Promise<void> {
  if (reloading) return;
  let latest: string;
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    if (!data.buildId) return;
    latest = data.buildId;
  } catch {
    return; // offline or a transient blip — try again next cycle
  }

  if (latest === CURRENT) {
    writePending(null); // we're current; clear any stale pending marker
    return;
  }
  // A newer build is live but we're still on the old one. If we already tried
  // reloading toward this exact build and it didn't take, the new bundle isn't
  // reachable yet — stop, so we don't loop. A manual refresh remains the escape.
  if (readPending() === latest) return;
  // Don't yank the page out from under someone mid-note; catch it next cycle.
  if (isTyping()) return;

  writePending(latest);
  reloading = true;
  location.reload();
}

export function startAutoUpdate(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.addEventListener('focus', () => void checkForUpdate());
  window.setInterval(() => void checkForUpdate(), POLL_MS);
}
