// ── v2 entry point / router ──
// One mount node (#app). The router reacts to store.role and a small local
// `wantJoin` flag, mounting exactly one screen at a time. Mutations elsewhere
// (login, joinCase, logout) flip store.role; the router does the rest.
//
// Screens are loaded with dynamic import() so the initial payload is just the
// landing view (no Supabase, no GM/player code). Those chunks fetch on demand
// the first time their view is shown.

import './styles/index.css';
import { store, type AppState } from './state/store';
import { createLandingScreen } from './landing';

const app = document.getElementById('app');

// Local navigation state the store doesn't model.
let wantJoin = false;
// The currently mounted screen's teardown (GM/player screens own realtime).
let activeDestroy: (() => void) | null = null;
// A signature of the last render so we don't re-mount needlessly.
let lastKey = '';
// Monotonic token so a slow dynamic import can't mount over a newer view.
let mountToken = 0;

// `?case=` deep-link: jump straight to the join screen with the code prefilled.
const params = new URLSearchParams(location.search);
const presetCase = params.get('case') ?? undefined;
if (presetCase) wantJoin = true;

function mount(node: HTMLElement, destroy?: () => void): void {
  if (!app) return;
  activeDestroy?.();
  activeDestroy = destroy ?? null;
  app.replaceChildren(node);
}

// Mount a screen produced by an async loader, ignoring the result if the view
// changed again before the chunk finished loading.
async function mountAsync(load: () => Promise<{ element: HTMLElement; destroy?: () => void }>): Promise<void> {
  const token = ++mountToken;
  const screen = await load();
  if (token !== mountToken) { screen.destroy?.(); return; }
  mount(screen.element, screen.destroy);
}

function viewKey(s: AppState): string {
  if (s.role === 'gm') return s.gmAuthed ? 'gm' : 'gm-login';
  if (s.role === 'player') return 'player';
  return wantJoin ? 'join' : 'landing';
}

function render(s: AppState): void {
  const key = viewKey(s);
  if (key === lastKey) return; // same screen — its own subscriptions handle updates
  lastKey = key;

  switch (key) {
    case 'landing':
      wantJoin = false;
      mountToken++; // landing is synchronous — cancel any pending async mount
      mount(createLandingScreen(() => { wantJoin = true; lastKey = ''; render(store.getState()); }).element);
      break;
    case 'join':
      void mountAsync(() => import('./player/joinScreen').then((m) => m.createJoinScreen(presetCase)));
      break;
    case 'gm-login':
      void mountAsync(() => import('./gm/loginScreen').then((m) => m.createGMLoginScreen()));
      break;
    case 'gm':
      void mountAsync(() => import('./gm/screen').then((m) => m.createGMScreen()));
      break;
    case 'player':
      void mountAsync(() => import('./player/screen').then((m) => m.createPlayerScreen()));
      break;
  }
}

store.subscribe(render);
render(store.getState());
