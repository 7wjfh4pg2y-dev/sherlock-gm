// ── Rules modal ──
// Opens the game's rules reference (setup, turns, scoring) in the shared modal.
// Self-contained: caller just wires a header button to openRulesModal().

import { h } from '../util/dom';
import { openTitledModal } from './modal';
import { RULES_INTRO, RULES_SECTIONS } from '../data/rules';

export function openRulesModal(): void {
  const { body } = openTitledModal('How to Play', { contentClass: 'rules-modal' });

  body.append(h('p', { class: 'rules-intro', text: RULES_INTRO }));

  for (const section of RULES_SECTIONS) {
    body.append(
      h('section', { class: 'rules-section' },
        h('h3', { class: 'rules-heading', text: section.heading }),
        ...section.paragraphs.map((p) => h('p', { class: 'rules-para', text: p })),
      ),
    );
  }
}
