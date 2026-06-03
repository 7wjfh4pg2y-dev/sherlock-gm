// ── Landing screen ──
// Two doors: Game Master or Investigator. GM sets store.role='gm' (router shows
// login). Investigator triggers the supplied onJoin callback (router shows the
// join screen). The router owns navigation; landing only signals intent.

import { h } from './util/dom';
import { store } from './state/store';

export interface LandingHandle {
  element: HTMLElement;
}

export function createLandingScreen(onJoin: () => void): LandingHandle {
  const gmBtn = h('button', {
    class: 'btn btn-primary',
    text: 'Enter as GM',
    on: { click: () => store.set({ role: 'gm', gmAuthed: false }) },
  });
  const playerBtn = h('button', {
    class: 'btn btn-secondary',
    text: 'Join as Investigator',
    on: { click: onJoin },
  });

  const card = h(
    'div',
    { class: 'landing-card' },
    h('div', { class: 'landing-eyebrow', text: 'Sherlock Holmes: Consulting Detective' }),
    h('div', { class: 'landing-title', text: 'The Casebook' }),
    h('div', { class: 'landing-divider' }, h('span', { class: 'landing-divider-ornament', text: '— ✦ —' })),
    h('p', { class: 'landing-desc' },
      'The game is afoot. Scour the city, find the clues,',
      h('br'),
      'and bring your answer to 221B Baker Street.',
    ),
    h('div', { class: 'btn-row' }, gmBtn, playerBtn),
  );
  return { element: h('div', { class: 'landing' }, card) };
}
