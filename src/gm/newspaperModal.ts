// ── GM Newspaper Library modal ──
// A shared library (like Maps Library): the GM uploads PDFs/images once, then
// toggles which are enabled for the current case. Enabled papers are always
// visible to that case's players. Self-contained: reads/writes store + Supabase.

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
  const uploadBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Add to Library' });

  const { body } = openTitledModal('Newspaper Library', { contentClass: 'maps-library-modal' });

  function refresh(): void {
    const s = store.getState();
    renderGrid(s.newspapers, new Set(s.caseNewspaperIds));
  }

  function renderGrid(rows: NewspaperRow[], enabled: Set<string>): void {
    clear(grid);
    if (!rows.length) {
      grid.append(h('p', { class: 'empty-state', text: 'No newspapers uploaded yet.' }));
      return;
    }
    const caseId = store.getState().currentCaseId;
    for (const p of rows) {
      const isEnabled = !!caseId && enabled.has(p.id);
      const toggleBtn = !caseId
        ? h('button', { class: 'btn btn-secondary btn-sm', text: 'Use in this case', attrs: { disabled: '', title: 'Select a case first' } })
        : isEnabled
        ? h('button', {
            class: 'btn btn-secondary btn-sm map-attached',
            text: '✓ In this case',
            on: { click: () => void toggle(p.id, false) },
          })
        : h('button', {
            class: 'btn btn-primary btn-sm',
            text: 'Use in this case',
            on: { click: () => void toggle(p.id, true) },
          });

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
              await reload();
              toast('Newspaper renamed.');
            } catch { toast('Could not rename newspaper.'); }
          },
        },
      });
      const deleteBtn = h('button', {
        class: 'btn btn-danger btn-sm',
        text: '🗑',
        on: {
          click: async () => {
            if (!(await confirmDelete('Remove this newspaper from the library? It will be removed from every case.'))) return;
            try {
              await paperRepo.remove(p.id);
              await reload();
              toast('Newspaper removed.');
            } catch { toast('Could not delete newspaper.'); }
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
          { class: isEnabled ? 'map-card map-card-attached' : 'map-card' },
          preview,
          h(
            'div',
            { class: 'map-card-body' },
            toggleBtn,
            renameInput,
            h('div', { class: 'map-card-actions' }, renameBtn, deleteBtn),
          ),
        ),
      );
    }
  }

  async function reload(): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (caseId) await loadGMNewspapers(caseId);
    else store.set({ newspapers: await paperRepo.list() });
    refresh();
  }

  async function toggle(newspaperId: string, on: boolean): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;
    try {
      if (on) await paperRepo.enable(caseId, newspaperId);
      else await paperRepo.disable(caseId, newspaperId);
      await loadGMNewspapers(caseId);
      refresh();
      toast(on ? 'Newspaper enabled for this case.' : 'Newspaper removed from this case.');
    } catch { toast('Could not update newspaper.'); }
  }

  refresh();

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files?.[0];
    if (!file) { uploadErr.textContent = 'Select a scan or PDF.'; return; }
    const name = nameInput.value.trim() || `Newspaper ${store.getState().newspapers.length + 1}`;
    uploadErr.textContent = 'Uploading…';
    uploadBtn.setAttribute('disabled', '');
    try {
      const url = await storage.uploadNewspaperImage(file);
      const position = store.getState().newspapers.length + 1;
      await paperRepo.create({ name, image_url: url, position });
      await reload();
      nameInput.value = '';
      fileInput.value = '';
      fileLabel.textContent = 'Click to select newspaper scan (image or PDF)';
      uploadErr.textContent = '';
      uploadBtn.removeAttribute('disabled');
      toast('Newspaper added to library!');
    } catch {
      uploadErr.textContent = 'Upload failed.';
      uploadBtn.removeAttribute('disabled');
    }
  });

  body.append(
    grid,
    h('div', { class: 'maps-upload-form' },
      h('h3', { class: 'form-section-title', text: 'Add Newspaper to Library' }),
      nameInput,
      fileLabel,
      uploadErr,
      uploadBtn,
    ),
  );
}
