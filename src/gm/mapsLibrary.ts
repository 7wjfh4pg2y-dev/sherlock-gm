// ── GM Maps Library modal ──
// Self-contained: opens its own modal, reads/writes the store and Supabase
// directly. Extracted from screen.ts to keep that file focused on the screen
// layout + reactive render paths.

import { h, clear } from '../util/dom';
import { store, selectors } from '../state/store';
import type { MapRow } from '../data/types';
import { cases as caseRepo, maps as mapRepo, storage } from '../data/supabase';
import { loadGMMaps } from './load';
import { openTitledModal } from '../components/modal';
import { confirmDelete } from '../components/confirmDelete';
import { toast } from '../components/toast';
import { openMapViewer } from '../components/mapViewer';

export function openMapsLibrary(): void {
  const s = store.getState();
  const currentMapId = selectors.currentCase(s)?.map_id ?? null;

  const grid = h('div', { class: 'maps-grid' });
  const nameInput = h('input', {
    class: 'gm-input',
    attrs: { type: 'text', placeholder: 'Map name' },
  }) as HTMLInputElement;
  const fileInput = h('input', {
    attrs: { type: 'file', accept: 'image/*', style: 'display:none' },
  }) as HTMLInputElement;
  const fileLabel = h('label', { class: 'file-drop-label', text: 'Click to select image' });
  fileLabel.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) fileLabel.textContent = '📄 ' + fileInput.files[0].name;
  });
  const uploadErr = h('div', { class: 'form-error' });
  const uploadBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Add Map' });

  const { body } = openTitledModal('Maps Library', { contentClass: 'maps-library-modal' }); // handle not needed; × button suffices

  function renderGrid(mapRows: MapRow[], attachedId: string | null): void {
    clear(grid);
    if (!mapRows.length) {
      grid.append(h('p', { class: 'empty-state', text: 'No maps uploaded yet.' }));
      return;
    }
    for (const m of mapRows) {
      const isAttached = !!store.getState().currentCaseId && m.id === attachedId;
      const attachBtn = !store.getState().currentCaseId
        ? h('button', { class: 'btn btn-secondary btn-sm', text: 'Use in this case', attrs: { disabled: '', title: 'Select a case first' } })
        : isAttached
        ? h('button', {
            class: 'btn btn-secondary btn-sm map-attached',
            text: '✓ In this case',
            on: { click: () => void attachMap(null, mapRows, m.id) },
          })
        : h('button', {
            class: 'btn btn-primary btn-sm',
            text: 'Use in this case',
            on: { click: () => void attachMap(m.id, mapRows, m.id) },
          });

      const renameInput = h('input', {
        class: 'gm-input map-rename-input',
        attrs: { type: 'text', value: m.name },
      }) as HTMLInputElement;
      const renameBtn = h('button', {
        class: 'btn btn-secondary btn-sm',
        text: 'Rename',
        on: {
          click: async () => {
            const name = renameInput.value.trim();
            if (!name) { toast('Enter a name first.'); return; }
            try {
              await mapRepo.rename(m.id, name);
              await loadGMMaps();
              toast('Map renamed.');
              renderGrid(store.getState().maps, store.getState().cases.find((c) => c.id === store.getState().currentCaseId)?.map_id ?? null);
            } catch { toast('Could not rename map.'); }
          },
        },
      });
      const deleteBtn = h('button', {
        class: 'btn btn-danger btn-sm',
        text: '🗑',
        on: {
          click: async () => {
            if (!(await confirmDelete('Remove this map from the library?'))) return;
            try {
              await mapRepo.remove(m.id);
              await loadGMMaps();
              toast('Map removed.');
              renderGrid(store.getState().maps, store.getState().cases.find((c) => c.id === store.getState().currentCaseId)?.map_id ?? null);
            } catch { toast('Could not delete map.'); }
          },
        },
      });

      const card = h(
        'div',
        { class: isAttached ? 'map-card map-card-attached' : 'map-card' },
        h('img', {
          class: 'map-thumb',
          attrs: { src: m.url, alt: m.name },
          on: { click: () => openMapViewer(m.url, m.name) },
        }),
        h(
          'div',
          { class: 'map-card-body' },
          attachBtn,
          renameInput,
          h('div', { class: 'map-card-actions' }, renameBtn, deleteBtn),
        ),
      );
      grid.append(card);
    }
  }

  async function attachMap(mapId: string | null, mapRows: MapRow[], _clickedId: string): Promise<void> {
    const caseId = store.getState().currentCaseId;
    if (!caseId) return;
    try {
      await caseRepo.setMap(caseId, mapId);
      // Update store cases.
      store.set({
        cases: store.getState().cases.map((c) => c.id === caseId ? { ...c, map_id: mapId } : c),
      });
      toast(mapId ? 'Map attached to case.' : 'Map detached from case.');
      renderGrid(mapRows, mapId);
    } catch { toast('Error updating map.'); }
  }

  renderGrid(s.maps, currentMapId);

  uploadBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const file = fileInput.files?.[0];
    if (!name) { uploadErr.textContent = 'Enter a map name.'; return; }
    if (!file) { uploadErr.textContent = 'Select an image.'; return; }
    uploadErr.textContent = 'Uploading…';
    uploadBtn.setAttribute('disabled', '');
    try {
      const url = await storage.uploadMapImage(file);
      await mapRepo.create({ name, url });
      await loadGMMaps();
      nameInput.value = '';
      fileInput.value = '';
      fileLabel.textContent = 'Click to select image';
      uploadErr.textContent = '';
      uploadBtn.removeAttribute('disabled');
      toast('Map added to library!');
      renderGrid(store.getState().maps, store.getState().cases.find((c) => c.id === store.getState().currentCaseId)?.map_id ?? null);
    } catch {
      uploadErr.textContent = 'Upload failed.';
      uploadBtn.removeAttribute('disabled');
    }
  });

  body.append(
    grid,
    h('div', { class: 'maps-upload-form' },
      h('h3', { class: 'form-section-title', text: 'Add New Map' }),
      nameInput,
      fileLabel,
      uploadErr,
      uploadBtn,
    ),
  );
}
