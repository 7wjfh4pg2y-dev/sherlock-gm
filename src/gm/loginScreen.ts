// ── GM login screen ──
// Presented at the landing when the user clicks "Game Master". The password is
// verified server-side (Supabase RPC) — see auth.ts. There is no in-app reset:
// the password is set/changed only from the Supabase dashboard, so a player
// can't reset it to let themselves in.

import { h } from '../util/dom';
import { attemptLogin, isGMSessionActive } from './auth';
import { store } from '../state/store';

export interface LoginHandle {
  element: HTMLElement;
}

/** Returns a login form. On success, sets store.role = 'gm'. */
export function createGMLoginScreen(): LoginHandle {
  const pwInput = h('input', {
    class: 'gm-input',
    attrs: { type: 'password', placeholder: 'Password', autocomplete: 'current-password' },
  }) as HTMLInputElement;
  const errEl = h('div', { class: 'form-error' });
  const loginBtn = h('button', { class: 'btn btn-primary', text: 'Enter' });

  let busy = false;
  async function tryLogin(): Promise<void> {
    if (busy) return;
    busy = true;
    errEl.textContent = '';
    loginBtn.textContent = 'Checking…';
    loginBtn.setAttribute('disabled', '');
    const err = await attemptLogin(pwInput.value.trim());
    busy = false;
    loginBtn.textContent = 'Enter';
    loginBtn.removeAttribute('disabled');
    if (err) { errEl.textContent = err; return; }
    store.set({ role: 'gm', gmAuthed: true });
  }

  loginBtn.addEventListener('click', () => void tryLogin());
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') void tryLogin(); });

  const hint = isGMSessionActive()
    ? h('p', { class: 'gm-login-hint', text: 'Enter the Game Master password to continue.' })
    : h('p', { class: 'gm-login-hint', text: 'Enter the Game Master password.' });

  const element = h(
    'div',
    { class: 'gm-login-screen' },
    h('h2', { class: 'gm-login-title', text: 'Game Master Access' }),
    hint,
    pwInput,
    errEl,
    loginBtn,
  );

  return { element };
}
