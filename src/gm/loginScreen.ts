// ── GM login screen ──
// Presented at the landing when the user clicks "Game Master". Simple password
// gate — session-only, not a security boundary.

import { h } from '../util/dom';
import { attemptLogin, isGMSessionActive, resetGMPassword } from './auth';
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
  const resetBtn = h('button', {
    class: 'btn btn-secondary btn-sm gm-reset-pw',
    text: 'Reset password',
    on: {
      click: () => {
        if (!confirm('Reset GM password? You will need to set a new one on next login.')) return;
        resetGMPassword();
        errEl.textContent = 'Password reset. Enter a new password to set it.';
        pwInput.value = '';
      },
    },
  });

  function tryLogin(): void {
    const err = attemptLogin(pwInput.value.trim());
    if (err) { errEl.textContent = err; return; }
    store.set({ role: 'gm', gmAuthed: true });
  }

  loginBtn.addEventListener('click', tryLogin);
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

  const hint = isGMSessionActive()
    ? h('p', { class: 'gm-login-hint', text: 'Re-enter your password to continue.' })
    : h('p', { class: 'gm-login-hint', text: 'First login? Enter a password to set it.' });

  const element = h(
    'div',
    { class: 'gm-login-screen' },
    h('h2', { class: 'gm-login-title', text: 'Game Master Access' }),
    hint,
    pwInput,
    errEl,
    loginBtn,
    resetBtn,
  );

  return { element };
}
