// ── Player join screen ──
// Name + case-code form. If a `?case=` param (full UUID or 8-char prefix) is
// present, the code is pre-filled and locked. Resolves short prefix codes to a
// full case id, then hands off to joinCase().

import { h } from '../util/dom';
import { cases } from '../data/supabase';
import { PLAYER_COLORS } from '../data/colors';
import { joinCase } from './join';

export interface JoinScreenHandle {
  element: HTMLElement;
}

/** Resolve a full UUID or 8-hex-char prefix to a case id, or null. */
async function resolveCaseId(raw: string): Promise<string | null> {
  const code = raw.trim();
  if (!code) return null;
  // Full UUID — use as-is.
  if (/^[0-9a-fA-F-]{36}$/.test(code)) return code;
  // 8-char prefix — match against the case list.
  if (/^[0-9a-fA-F]{8}$/.test(code)) {
    const prefix = code.toLowerCase();
    const all = await cases.list();
    return all.find((c) => c.id.startsWith(prefix))?.id ?? null;
  }
  return null;
}

export function createJoinScreen(presetCaseCode?: string): JoinScreenHandle {
  const codeInput = h('input', {
    class: 'gm-input',
    attrs: { type: 'text', placeholder: 'Case code (e.g. A3F8C21B)', maxlength: '36' },
  }) as HTMLInputElement;
  if (presetCaseCode) {
    codeInput.value = presetCaseCode;
    codeInput.setAttribute('readonly', '');
  }
  const nameInput = h('input', {
    class: 'gm-input',
    attrs: { type: 'text', placeholder: 'Your name (e.g. Dr. Watson)', maxlength: '32' },
  }) as HTMLInputElement;
  const errEl = h('div', { class: 'form-error' });
  const joinBtn = h('button', { class: 'btn btn-primary btn-full', text: 'Enter the Case Room' });

  // ── Color picker ──
  let selectedColor = PLAYER_COLORS[0]!.value;
  const colorSwatches = PLAYER_COLORS.map(({ label, value }) => {
    const swatch = h('button', {
      class: 'color-swatch' + (value === selectedColor ? ' selected' : ''),
      attrs: { type: 'button', title: label, 'aria-label': label, 'data-color': value },
    }) as HTMLButtonElement;
    swatch.style.background = value;
    swatch.addEventListener('click', () => {
      selectedColor = value;
      for (const s of colorSwatchWrap.querySelectorAll<HTMLElement>('.color-swatch')) {
        s.classList.toggle('selected', s.dataset['color'] === value);
      }
    });
    return swatch;
  });
  const colorSwatchWrap = h('div', { class: 'color-picker-row' }, ...colorSwatches);
  const colorPickerLabel = h('div', { class: 'color-picker-label', text: 'Choose your colour:' });

  async function submit(): Promise<void> {
    const name = nameInput.value.trim();
    if (!name) { errEl.textContent = 'Enter your name.'; return; }
    errEl.textContent = 'Resolving case…';
    joinBtn.setAttribute('disabled', '');
    try {
      const caseId = await resolveCaseId(codeInput.value);
      if (!caseId) { errEl.textContent = 'No case found for that code.'; joinBtn.removeAttribute('disabled'); return; }
      const result = await joinCase(name, caseId, selectedColor);
      if (!result.ok) {
        errEl.textContent = result.error ?? 'Could not join.';
        joinBtn.removeAttribute('disabled');
        return;
      }
      // On success, joinCase sets store.role='player' → router swaps the screen.
      // Safety net: if the screen hasn't swapped after 15 s, re-enable the button.
      setTimeout(() => {
        if (joinBtn.disabled) {
          errEl.textContent = 'Something went wrong loading the case room. Please try again.';
          joinBtn.removeAttribute('disabled');
        }
      }, 15_000);
    } catch (err) {
      console.error('[join] error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      errEl.textContent = `Could not join: ${msg}`;
      joinBtn.removeAttribute('disabled');
    }
  }

  joinBtn.addEventListener('click', () => void submit());
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') void submit(); });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.focus(); });

  const card = h(
    'div',
    { class: 'landing-card' },
    h('div', { class: 'landing-eyebrow', text: 'Join a Case' }),
    h('div', { class: 'landing-title', text: 'Identify Yourself' }),
    h('div', { class: 'landing-divider' }, h('span', { class: 'landing-divider-ornament', text: '— ✦ —' })),
    codeInput,
    nameInput,
    colorPickerLabel,
    colorSwatchWrap,
    errEl,
    joinBtn,
  );
  const element = h('div', { class: 'landing' }, card);
  // Focus the appropriate field.
  setTimeout(() => (presetCaseCode ? nameInput : codeInput).focus(), 0);
  return { element };
}
