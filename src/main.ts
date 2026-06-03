// ── v2 entry point / router ──
// One mount node (#app). The router reacts to store.role and a small local
// `wantJoin` flag, mounting exactly one screen at a time. Mutations elsewhere
// (login, joinCase, logout) flip store.role; the router does the rest.

import './styles/index.css';
import { store, type AppState } from './state/store';
import { createLandingScreen } from './landing';
import { createGMLoginScreen } from './gm/loginScreen';
import { createGMScreen } from './gm/screen';
import { createJoinScreen } from './player/joinScreen';
import { createPlayerScreen } from './player/screen';

const app = document.getElementById('app');

// Local navigation state the store doesn't model.
let wantJoin = false;
// The currently mounted screen's teardown (GM/player screens own realtime).
let activeDestroy: (() => void) | null = null;
// A signature of the last render so we don't re-mount needlessly.
let lastKey = '';

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
      mount(createLandingScreen(() => { wantJoin = true; lastKey = ''; render(store.getState()); }).element);
      break;
    case 'join':
      mount(createJoinScreen(presetCase).element);
      break;
    case 'gm-login':
      mount(createGMLoginScreen().element);
      break;
    case 'gm': {
      const screen = createGMScreen();
      mount(screen.element, screen.destroy);
      break;
    }
    case 'player': {
      const screen = createPlayerScreen();
      mount(screen.element, screen.destroy);
      break;
    }
  }
}

store.subscribe(render);
render(store.getState());
