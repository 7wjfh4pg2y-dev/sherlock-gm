// ── Scotland Yard modal ──
// Case management: create, edit, and delete cases. Mirrors the self-contained
// pattern of Cartographer and Printing Press — opens its own modal and reads
// the store directly. Mutations that affect the case dropdown/selection are
// handed back via callbacks supplied by the GM screen.

import { h } from '../util/dom';
import { store, selectors } from '../state/store';
import type { CaseRow } from '../data/types';
import { cases as caseRepo } from '../data/supabase';
import { openTitledModal } from '../components/modal';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { openClueImporter } from './clueImporter';

export interface ScotlandYardCallbacks {
  /** Called after a case is created so the dropdown and store can refresh. */
  onCaseCreated(c: CaseRow): Promise<void>;
  /** Called after a case is updated so the dropdown reflects the new name. */
  onCaseUpdated(c: CaseRow): void;
  /** Called after a case is deleted so the screen resets to the empty state. */
  onCaseDeleted(caseId: string): void;
}

export function openScotlandYard(callbacks: ScotlandYardCallbacks): void {
  const { handle, body } = openTitledModal('Scotland Yard', { contentClass: 'scotland-yard-modal' });

  function renderContent(): void {
    const s = store.getState();
    const current = selectors.currentCase(s);
    const cases = s.cases;

    // ── New Case ──
    const newSection = h('div', { class: 'sy-section' },
      h('div', { class: 'sy-section-label', text: 'Open a new case' }),
    );
    const newNameInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'text', placeholder: 'Case name' },
    }) as HTMLInputElement;
    const newOrderInput = h('input', {
      class: 'gm-input',
      attrs: { type: 'number', min: '1', placeholder: 'Order in campaign (e.g. 1)' },
    }) as HTMLInputElement;
    const newErrEl = h('div', { class: 'form-error' });
    const newSaveBtn = h('button', { class: 'btn btn-primary btn-sm', text: '+ Open Case' });
    newSaveBtn.addEventListener('click', async () => {
      const name = newNameInput.value.trim();
      if (!name) { newErrEl.textContent = 'Enter a case name.'; return; }
      newSaveBtn.setAttribute('disabled', '');
      try {
        const c = await caseRepo.create({
          name,
          description: null,
          ordinal: parseInt(newOrderInput.value, 10) || 0,
        });
        toast(`Case "${c.name}" opened.`);
        await callbacks.onCaseCreated(c);
        handle.close();
      } catch {
        newErrEl.textContent = 'Could not create case.';
        newSaveBtn.removeAttribute('disabled');
      }
    });
    newSection.append(newNameInput, newOrderInput, newErrEl, newSaveBtn);

    // ── Edit / Delete (only when a case is active) ──
    if (current) {
      const editSection = h('div', { class: 'sy-section sy-section--bordered' },
        h('div', { class: 'sy-section-label', text: `Editing: ${current.name}` }),
      );

      const editNameInput = h('input', {
        class: 'gm-input',
        attrs: { type: 'text', placeholder: 'Case name', value: current.name },
      }) as HTMLInputElement;
      const editOrderInput = h('input', {
        class: 'gm-input',
        attrs: { type: 'number', min: '1', placeholder: 'Order in campaign', value: String(current.ordinal ?? '') },
      }) as HTMLInputElement;
      const editErrEl = h('div', { class: 'form-error' });
      const editSaveBtn = h('button', { class: 'btn btn-edit btn-sm', text: '✎ Save Changes' });
      editSaveBtn.addEventListener('click', async () => {
        const name = editNameInput.value.trim();
        if (!name) { editErrEl.textContent = 'Enter a case name.'; return; }
        editSaveBtn.setAttribute('disabled', '');
        try {
          const updated = await caseRepo.updateFields(current.id, {
            name,
            description: current.description ?? null,
            ordinal: parseInt(editOrderInput.value, 10) || 0,
          });
          callbacks.onCaseUpdated(updated);
          toast('Case updated.');
          handle.close();
        } catch {
          editErrEl.textContent = 'Could not update case.';
          editSaveBtn.removeAttribute('disabled');
        }
      });

      const deleteBtn = h('button', { class: 'btn btn-danger btn-sm', text: 'Delete Case' });
      deleteBtn.addEventListener('click', async () => {
        if (!(await confirmDelete(`Delete case "${current.name}"? All clues, players, and notes will be lost.`))) return;
        try {
          await caseRepo.remove(current.id);
          callbacks.onCaseDeleted(current.id);
          toast('Case deleted.');
          handle.close();
        } catch {
          toast('Could not delete case.');
        }
      });

      editSection.append(editNameInput, editOrderInput, editErrEl,
        h('div', { class: 'sy-edit-row' }, editSaveBtn, deleteBtn));
      body.append(editSection);

      // ── Clue Importer (needs an active case) ──
      const importBtn = h('button', { class: 'btn btn-secondary btn-sm', text: '📖 Import Clues' });
      importBtn.addEventListener('click', () => {
        handle.close();
        openClueImporter();
      });
      const importSection = h('div', { class: 'sy-section sy-section--bordered' },
        h('div', { class: 'sy-section-label', text: 'Clue Importer' }),
        h('div', { class: 'sy-section-hint', text: 'Paste book-page text extracted by Claude.ai to bulk-add clues.' }),
        importBtn,
      );
      body.append(importSection);
    }

    // ── Case list (ascending by ordinal, unordered cases at the end) ──
    if (cases.length) {
      const sorted = [...cases].sort((a, b) => {
        const ao = a.ordinal ?? 0, bo = b.ordinal ?? 0;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
      const listSection = h('div', { class: 'sy-section sy-section--bordered' },
        h('div', { class: 'sy-section-label', text: 'All cases' }),
        ...sorted.map((c) => h('div', {
          class: 'sy-case-row' + (c.id === current?.id ? ' active' : ''),
        },
          c.ordinal ? h('span', { class: 'sy-case-ordinal', text: `#${c.ordinal}` }) : null,
          h('span', { class: 'sy-case-name', text: c.name }),
        )),
      );
      body.append(listSection);
    }

    body.prepend(newSection);
  }

  renderContent();
}
