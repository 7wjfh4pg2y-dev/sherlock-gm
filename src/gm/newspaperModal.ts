// ── GM Newspaper modal ──
// Manage the scanned newspaper pages for the current case: upload, rename,
// delete, click to zoom. Always visible to players once added. Self-contained:
// reads/writes the store + Supabase directly. Extracted like mapsLibrary.

import { h, clear } from '../util/dom';
import { store } from '../state/store';
import type { NewspaperRow } from '../data/types';
import { newspapers as paperRepo, storage } from '../data/supabase';
import { loadGMNewspapers } from './load';
import { openTitledModal } from '../components/modal';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { openMapViewer } from '../components/mapViewer';

export function openNewspaperModal(): void {
  const caseId = store.getState().currentCaseId;
  if (!caseId) { toast('Select a case first.'); return; }

  const grid = h('div', { class: 'maps-grid' });
  const nameInput = h('input', {
    class: 'gm-input',
    attrs: { type: 'text', placeholder: 'Label (e.g. The Times, 15 Oct)' },
  }) as HTMLInputElement;
  const fileInput = h('input', {
    attrs: { type: 'file', accept: 'image/*,application/pdf', style: 'display:none' },
  }) as HTMLInputElement;
  const fileLabel = h('label', { class: 'file-drop-label', text: 'Click to select newspaper scan (image or PDF)' });
  fileLabel.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) fileLabel.textContent = '📄 ' + fileInput.files[0].name;
  });
  const uploadErr = h('div', { class: 'form-error' });
  const uploadBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Add Page' });

  const { body } = openTitledModal('Newspaper', { contentClass: 'maps-library-modal' }); // handle not needed; × button suffices

  function renderGrid(rows: NewspaperRow[]): void {
    clear(grid);
    if (!rows.length) {
      grid.append(h('p', { class: 'empty-state', text: 'No newspapers added yet. Add as many as the case requires.' }));
      return;
    }
    for (const p of rows) {
      const renameInput = h('input', {
        class: 'gm-input map-rename-input',
        attrs: { type: 'text', value: p.name },
      }) as HTMLInputElement;
      const renameBtn = h('button', {
        class: 'btn btn-secondary btn-sm',
        text: 'Rename',
        on: {
          click: async () => {
            const name = renameInput.value.trim();
            if (!name) { toast('Enter a label first.'); return; }
            try {
              await paperRepo.rename(p.id, name);
              await loadGMNewspapers(caseId!);
              toast('Page renamed.');
              renderGrid(store.getState().newspapers);
            } catch { toast('Could not rename page.'); }
          },
        },
      });
      const deleteBtn = h('button', {
        class: 'btn btn-danger btn-sm',
        text: '🗑',
        on: {
          click: async () => {
            if (!(await confirmDelete('Remove this newspaper page?'))) return;
            try {
              await paperRepo.remove(p.id);
              await loadGMNewspapers(caseId!);
              toast('Page removed.');
              renderGrid(store.getState().newspapers);
            } catch { toast('Could not delete page.'); }
          },
        },
      });

      const isPdf = p.image_url.split('?')[0].toLowerCase().endsWith('.pdf');
      const preview = isPdf
        ? h('div', {
            class: 'map-thumb map-thumb--pdf',
            text: '📄',
            on: { click: () => openMapViewer(p.image_url, p.name) },
          })
        : h('img', {
            class: 'map-thumb',
            attrs: { src: p.image_url, alt: p.name },
            on: { click: () => openMapViewer(p.image_url, p.name) },
          });

      grid.append(
        h(
          'div',
          { class: 'map-card' },
          preview,
          h(
            'div',
            { class: 'map-card-body' },
            renameInput,
            h('div', { class: 'map-card-actions' }, renameBtn, deleteBtn),
          ),
        ),
      );
    }
  }

  renderGrid(store.getState().newspapers);

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files?.[0];
    if (!file) { uploadErr.textContent = 'Select a scan image.'; return; }
    const name = nameInput.value.trim() || `Newspaper ${store.getState().newspapers.length + 1}`;
    uploadErr.textContent = 'Uploading…';
    uploadBtn.setAttribute('disabled', '');
    try {
      const url = await storage.uploadNewspaperImage(file);
      const position = store.getState().newspapers.length + 1;
      await paperRepo.create({ case_id: caseId!, name, image_url: url, position });
      await loadGMNewspapers(caseId!);
      nameInput.value = '';
      fileInput.value = '';
      fileLabel.textContent = 'Click to select scan';
      uploadErr.textContent = '';
      uploadBtn.removeAttribute('disabled');
      toast('Newspaper page added!');
      renderGrid(store.getState().newspapers);
    } catch {
      uploadErr.textContent = 'Upload failed.';
      uploadBtn.removeAttribute('disabled');
    }
  });

  body.append(
    grid,
    h('div', { class: 'maps-upload-form' },
      h('h3', { class: 'form-section-title', text: 'Add Newspaper' }),
      nameInput,
      fileLabel,
      uploadErr,
      uploadBtn,
    ),
  );
}
