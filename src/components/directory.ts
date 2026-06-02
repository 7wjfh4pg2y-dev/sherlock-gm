// ── London Directory modal ──
// Search + category filter over the directory; GM additionally gets add / edit /
// remove. Reads the directory data manager; persistence lives there.

import { h, replaceChildren } from '../util/dom';
import { openModal } from './modal';
import { confirmDelete } from './confirmDelete';
import { toast } from './toast';
import * as directory from '../data/directory';
import type { DirectoryEntry } from '../data/types';

export function openDirectoryModal(isGM: boolean): void {
  // ── Search controls ──
  const searchInput = h('input', {
    class: 'directory-search-input',
    attrs: { type: 'text', placeholder: 'Search by name or location…' },
  });
  const categorySelect = h('select', { class: 'directory-category-select' });
  const resultsInfo = h('div', { class: 'directory-results-info' });
  const results = h('div', { class: 'directory-results' });

  function refreshCategories(): void {
    const current = categorySelect.value;
    replaceChildren(
      categorySelect,
      h('option', { attrs: { value: '' }, text: 'All Categories' }),
      ...directory.categories().map((c) => h('option', { attrs: { value: c }, text: c })),
    );
    categorySelect.value = current;
  }

  function renderResults(): void {
    const { entries, total, limited } = directory.search(searchInput.value, categorySelect.value);
    if (!searchInput.value.trim() && !categorySelect.value) {
      resultsInfo.textContent = '';
      replaceChildren(results, h('div', { class: 'directory-empty', text: 'Enter a name or select a category to search.' }));
      return;
    }
    if (total === 0) {
      resultsInfo.textContent = '';
      replaceChildren(results, h('div', { class: 'directory-empty', text: 'No entries found.' }));
      return;
    }
    resultsInfo.textContent = `${total} result${total === 1 ? '' : 's'}${limited ? ' — showing first 200' : ''}`;
    replaceChildren(results, ...entries.map((e) => entryRow(e)));
  }

  function entryRow(entry: DirectoryEntry): HTMLElement {
    const isCustom = !!entry.id;
    const actions = isGM
      ? h(
          'span',
          { class: 'directory-entry-actions' },
          isCustom
            ? h('button', {
                class: 'directory-action-btn',
                text: '✎',
                attrs: { title: 'Edit' },
                on: { click: () => openEditForm(entry) },
              })
            : null,
          h('button', {
            class: 'directory-action-btn directory-delete-btn',
            text: '✕',
            attrs: { title: 'Remove' },
            on: { click: () => onRemove(entry) },
          }),
        )
      : null;
    return h(
      'div',
      { class: 'directory-entry' },
      isCustom ? h('span', { class: 'directory-custom-badge', attrs: { title: 'Custom entry' }, text: '★' }) : null,
      h('span', { class: 'directory-entry-name', text: entry.name }),
      h('span', { class: 'directory-dots', attrs: { 'aria-hidden': 'true' } }),
      entry.category ? h('span', { class: 'directory-entry-category', text: entry.category }) : null,
      h('span', { class: 'directory-entry-location', text: entry.location }),
      actions,
    );
  }

  async function onRemove(entry: DirectoryEntry): Promise<void> {
    if (!(await confirmDelete(`Remove "${entry.name}" from the directory?`, 'Remove'))) return;
    await directory.removeEntry(entry);
    refreshCategories();
    renderResults();
  }

  // ── GM add / edit form ──
  let editingId: string | null = null;
  const nameInput = h('input', { class: 'field-input', attrs: { type: 'text', placeholder: 'Name' } });
  const locationInput = h('input', { class: 'field-input', attrs: { type: 'text', placeholder: 'Location (e.g. 24 NW)' } });
  const categoryInput = h('input', { class: 'field-input', attrs: { type: 'text', placeholder: 'Category (optional)' } });
  const submitBtn = h('button', { class: 'directory-add-submit-btn', text: 'Save', on: { click: () => submitForm() } });
  const addForm = h(
    'div',
    { class: 'directory-add-row', style: { display: 'none' } },
    nameInput,
    locationInput,
    categoryInput,
    submitBtn,
  );

  function shake(el: HTMLInputElement): void {
    el.classList.add('input-shake');
    setTimeout(() => el.classList.remove('input-shake'), 400);
    el.focus();
  }

  function clearForm(): void {
    nameInput.value = '';
    locationInput.value = '';
    categoryInput.value = '';
    editingId = null;
  }

  function openEditForm(entry: DirectoryEntry): void {
    editingId = entry.id ?? null;
    nameInput.value = entry.name;
    locationInput.value = entry.location;
    categoryInput.value = entry.category ?? '';
    addForm.style.display = '';
    setTimeout(() => nameInput.focus(), 50);
  }

  async function submitForm(): Promise<void> {
    const name = nameInput.value.trim();
    const location = locationInput.value.trim();
    const category = categoryInput.value.trim() || null;
    if (!name) return shake(nameInput);
    if (!location) return shake(locationInput);

    if (editingId) {
      await directory.updateCustomEntry(editingId, name, location, category);
    } else {
      await directory.addCustomEntry(name, location, category);
    }
    clearForm();
    addForm.style.display = 'none';
    refreshCategories();
    renderResults();
    toast(`Saved: ${name}`);
  }

  const addToggle = isGM
    ? h('button', {
        class: 'directory-add-toggle-btn',
        text: '+ Add Entry',
        on: {
          click: () => {
            const open = addForm.style.display !== 'none';
            if (open) clearForm();
            addForm.style.display = open ? 'none' : '';
            if (!open) setTimeout(() => nameInput.focus(), 50);
          },
        },
      })
    : null;

  // ── Assemble ──
  const header = h(
    'div',
    { class: 'directory-modal-header' },
    h('span', { class: 'modal-title', text: 'London Directory' }),
    addToggle,
  );
  const searchRow = h(
    'div',
    { class: 'directory-search-row' },
    h(
      'div',
      { class: 'directory-search-wrap' },
      h('span', { class: 'directory-search-icon', text: '🔍' }),
      searchInput,
    ),
    categorySelect,
  );
  const content = h('div', {}, header, addForm, searchRow, resultsInfo, results);

  searchInput.addEventListener('input', renderResults);
  categorySelect.addEventListener('change', renderResults);

  refreshCategories();
  renderResults();
  openModal(content, { contentClass: 'directory-modal' });
  setTimeout(() => searchInput.focus(), 80);
}
