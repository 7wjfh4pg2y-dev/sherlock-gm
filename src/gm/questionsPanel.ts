// ── GM Questions + Solution panels ──
// Inline tab content for authoring end-of-case questions (prompt + official
// answer + points), revealing answers to players, and writing/revealing
// Sherlock's solution. Self-contained: reads the store, writes Supabase, and
// reloads via the GM loaders. Returns { element, refresh } like buildGMNotebook.

import { h, clear } from '../util/dom';
import { store, selectors } from '../state/store';
import type { QuestionRow } from '../data/types';
import { questions as questionRepo, solutions as solutionRepo } from '../data/supabase';
import { loadGMQuestions, loadGMSolution } from './load';
import { openTitledModal } from '../components/modal';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';

// ── Questions panel ──

export function buildGMQuestionsPanel(): { element: HTMLElement; refresh(): void } {
  const element = h('div', { class: 'gm-questions-panel' });

  function caseId(): string | null {
    return store.getState().currentCaseId;
  }

  async function reload(): Promise<void> {
    const id = caseId();
    if (id) await loadGMQuestions(id);
  }

  function showQuestionModal(existing?: QuestionRow): void {
    const id = caseId();
    if (!id) return;

    const promptInput = h('textarea', {
      class: 'gm-input',
      attrs: { placeholder: 'Question (e.g. Who murdered Lord Blackwood?)', rows: '3' },
    }) as HTMLTextAreaElement;
    const answerInput = h('textarea', {
      class: 'gm-input',
      attrs: { placeholder: 'Official answer (hidden from players until revealed)', rows: '4' },
    }) as HTMLTextAreaElement;
    const pointsInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'number', min: '0', placeholder: 'Points (e.g. 100)' },
    }) as HTMLInputElement;
    if (existing) {
      promptInput.value = existing.prompt;
      answerInput.value = existing.answer;
      pointsInput.value = String(existing.points);
    }
    const errEl = h('div', { class: 'form-error' });
    const saveBtn = h('button', { class: 'btn btn-primary', text: existing ? 'Save' : 'Add Question' });

    const { handle, body } = openTitledModal(existing ? 'Edit Question' : 'New Question', {});
    body.append(
      h('label', { class: 'form-label', text: 'Question' }), promptInput,
      h('label', { class: 'form-label', text: 'Official answer' }), answerInput,
      h('label', { class: 'form-label', text: 'Points' }), pointsInput,
      errEl,
      saveBtn,
    );

    saveBtn.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) { errEl.textContent = 'Enter the question.'; return; }
      const points = parseInt(pointsInput.value, 10) || 0;
      const answer = answerInput.value.trim();
      saveBtn.setAttribute('disabled', '');
      try {
        if (existing) {
          await questionRepo.update(existing.id, { prompt, answer, points });
          toast('Question updated.');
        } else {
          const position = store.getState().questions.length + 1;
          await questionRepo.create({ case_id: id, prompt, answer, points, position });
          toast('Question added.');
        }
        await reload();
        handle.close();
      } catch {
        errEl.textContent = 'Could not save question.';
        saveBtn.removeAttribute('disabled');
      }
    });
  }

  function questionCard(q: QuestionRow, index: number): HTMLElement {
    const team = selectors.teamAnswerFor(store.getState(), q.id);

    const revealBtn = h('button', {
      class: q.revealed ? 'btn btn-secondary btn-sm map-attached' : 'btn btn-primary btn-sm',
      text: q.revealed ? '✓ Answer revealed' : '👁 Reveal answer',
      on: {
        click: async () => {
          try { await questionRepo.setRevealed(q.id, !q.revealed); await reload(); }
          catch { toast('Could not update.'); }
        },
      },
    });
    const editBtn = h('button', { class: 'clue-action-btn edit', text: '✏️ Edit', on: { click: () => showQuestionModal(q) } });
    const delBtn = h('button', {
      class: 'clue-action-btn del', text: '🗑 Delete',
      on: {
        click: async () => {
          if (!(await confirmDelete('Delete this question?'))) return;
          try { await questionRepo.remove(q.id); await reload(); toast('Question deleted.'); }
          catch { toast('Could not delete.'); }
        },
      },
    });

    return h('div', { class: 'gm-question-card' },
      h('div', { class: 'gm-question-head' },
        h('span', { class: 'gm-question-num', text: `Q${index + 1}` }),
        h('span', { class: 'gm-question-prompt', text: q.prompt }),
        h('span', { class: 'points-badge', text: `${q.points} pts` }),
      ),
      h('div', { class: 'gm-question-answer' },
        h('span', { class: 'gm-question-label', text: 'Official answer' }),
        h('p', { class: 'gm-question-answer-text', text: q.answer || '—' }),
      ),
      h('div', { class: 'gm-question-team' },
        h('span', { class: 'gm-question-label', text: 'Team answer' }),
        team?.content
          ? h('p', { class: 'gm-question-team-text', text: team.content },
              h('span', { class: 'gm-question-team-by', text: team.updated_by ? ` — ${team.updated_by}` : '' }))
          : h('p', { class: 'gm-question-team-empty', text: 'No answer submitted yet.' }),
      ),
      h('div', { class: 'gm-question-actions' }, revealBtn, editBtn, delBtn),
    );
  }

  function render(): void {
    clear(element);
    const s = store.getState();
    const qs = s.questions;
    const total = selectors.totalPoints(s);
    const allRevealed = qs.length > 0 && qs.every((q) => q.revealed);

    const revealAllBtn = h('button', {
      class: 'btn btn-secondary btn-sm',
      text: allRevealed ? 'Hide all answers' : 'Reveal all answers',
      on: {
        click: async () => {
          const id = caseId();
          if (!id || !qs.length) return;
          try { await questionRepo.setRevealedAll(id, !allRevealed); await reload(); }
          catch { toast('Could not update answers.'); }
        },
      },
    });

    element.append(
      h('div', { class: 'gm-section-head' },
        h('div', { class: 'clues-section-title' },
          'Questions ',
          h('span', { class: 'counter-badge', text: String(qs.length) }),
          qs.length ? h('span', { class: 'gm-points-total', text: `${total} pts total` }) : null,
        ),
        qs.length ? revealAllBtn : null,
      ),
    );

    if (!qs.length) {
      element.append(h('p', { class: 'empty-state', text: 'No questions yet. Add the case’s end questions for players to answer.' }));
    } else {
      qs.forEach((q, i) => element.append(questionCard(q, i)));
    }

    element.append(h('div', { class: 'clue-add-card gm-question-add', on: { click: () => showQuestionModal() } },
      h('span', { class: 'clue-add-icon', text: '+' }),
      h('span', { text: 'Add Question' }),
    ));
  }

  render();
  return { element, refresh: render };
}

// ── Solution panel ──

export function buildGMSolutionPanel(): { element: HTMLElement; refresh(): void } {
  const element = h('div', { class: 'gm-solution-panel' });
  let editing = false;

  function caseId(): string | null {
    return store.getState().currentCaseId;
  }

  function render(): void {
    clear(element);
    const s = store.getState();
    const sol = s.solution;
    const content = sol?.content ?? '';
    const revealed = !!sol?.revealed;

    const revealToggle = h('button', {
      class: revealed ? 'btn btn-secondary btn-sm map-attached' : 'btn btn-primary btn-sm',
      text: revealed ? '✓ Revealed to players' : '👁 Reveal to players',
      on: {
        click: async () => {
          const id = caseId();
          if (!id) return;
          try { await solutionRepo.setRevealed(id, !revealed); await loadGMSolution(id); }
          catch { toast('Could not update.'); }
        },
      },
    });

    if (editing) {
      const textarea = h('textarea', {
        class: 'gm-input briefing-textarea',
        attrs: { rows: '16', placeholder: 'Write Sherlock’s full solution — how he reasoned it out, who did it and why…' },
      }) as HTMLTextAreaElement;
      textarea.value = content;
      const saveBtn = h('button', {
        class: 'btn btn-primary btn-sm', text: 'Save',
        on: {
          click: async () => {
            const id = caseId();
            if (!id) return;
            try { await solutionRepo.save(id, textarea.value.trim()); await loadGMSolution(id); editing = false; render(); toast('Solution saved.'); }
            catch { toast('Could not save solution.'); }
          },
        },
      });
      const cancelBtn = h('button', { class: 'btn btn-secondary btn-sm', text: 'Cancel', on: { click: () => { editing = false; render(); } } });
      element.append(
        h('div', { class: 'gm-section-head' }, h('div', { class: 'clues-section-title', text: 'Sherlock’s Solution' }), revealToggle),
        textarea,
        h('div', { class: 'briefing-edit-row' }, saveBtn, cancelBtn),
      );
      return;
    }

    element.append(
      h('div', { class: 'gm-section-head' }, h('div', { class: 'clues-section-title', text: 'Sherlock’s Solution' }), revealToggle),
      content
        ? h('div', { class: 'briefing-display' }, h('p', { class: 'briefing-text', text: content }))
        : h('span', { class: 'briefing-empty', text: 'No solution written yet.' }),
      h('button', { class: 'btn btn-secondary btn-sm', text: content ? '✏️ Edit Solution' : '✏️ Write Solution', on: { click: () => { editing = true; render(); } } }),
    );
  }

  render();
  return { element, refresh: () => { if (!editing) render(); } };
}
