// ── Clue Importer ──
// Paste-based importer: the GM photographs a book page, asks Claude.ai to
// extract it in a structured format, then pastes the result here for review
// and bulk-save. Zero API cost — Claude.ai is the OCR engine, this is just
// the parser/editor.
//
// Expected paste format (one clue per paragraph, blank line between):
//   SE 8
//   The tobacconist on Portman Street claims he saw…
//
//   NW 14
//   A young urchin loitering near the docks reported…
//
// Or single-line: "SE 8: The tobacconist on…"

import { h, replaceChildren } from '../util/dom';
import { store } from '../state/store';
import { clues as clueRepo } from '../data/supabase';
import { openTitledModal } from '../components/modal';
import { toast } from '../components/toast';

interface ParsedClue {
  location_name: string;
  clue_text: string;
}

// Attempt to detect the district + number header.
// Matches: "SE 8", "NW 14", "WC 3", "EC 11", "SW 7" — with or without colon,
// and in either order ("8 SE" as the book prints them, or "SE 8").
const LOCATION_RE = /^(?:(NW|WC|EC|SW|SE)\s*(\d+)|(\d+)\s*(NW|WC|EC|SW|SE))\s*:?\s*(.*)$/i;

function normaliseLocation(m: RegExpMatchArray): string {
  // Group 1/2 = "SE 8" order; group 3/4 = "8 SE" order.
  const district = (m[1] ?? m[4]).toUpperCase();
  const number = m[2] ?? m[3];
  return `${district} ${number}`;
}

// Collapse a run of body lines into clean paragraphs: a blank line separates
// paragraphs, while consecutive non-blank lines are de-wrapped into one (so
// OCR column-wrapping doesn't litter the text with hard breaks). Paragraph
// breaks are preserved as a blank line so the player view (white-space:
// pre-wrap) renders them.
function joinParagraphs(lines: string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) { paragraphs.push(current.join(' ')); current = []; }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs.join('\n\n');
}

function parseClues(raw: string): ParsedClue[] {
  const results: ParsedClue[] = [];
  const lines = raw.split('\n');
  let pending: { location_name: string; inlineText: string; body: string[] } | null = null;

  const flush = (): void => {
    if (!pending) return;
    // Inline text (from a "SE 8: text…" header) joins the body as its first
    // line so it flows into the first paragraph rather than splitting off.
    const bodyLines = pending.inlineText ? [pending.inlineText, ...pending.body] : pending.body;
    const clue_text = joinParagraphs(bodyLines);
    if (clue_text) results.push({ location_name: pending.location_name, clue_text });
    pending = null;
  };

  for (const line of lines) {
    const m = line.match(LOCATION_RE);
    if (m) {
      // A header line starts a new clue.
      flush();
      pending = { location_name: normaliseLocation(m), inlineText: (m[5] ?? '').trim(), body: [] };
    } else if (pending) {
      pending.body.push(line);
    }
    // Lines before the first header are ignored.
  }
  flush();
  return results;
}

export function openClueImporter(): void {
  const caseId = store.getState().currentCaseId!;
  if (!caseId) { toast('Open a case first.'); return; }

  const { handle, body } = openTitledModal('Clue Importer', { contentClass: 'clue-importer-modal' });

  // ── Step 1: instructions + paste area ──
  const instructions = h('div', { class: 'ci-instructions' },
    h('p', { text: 'How to use:' }),
    h('ol', {},
      h('li', { text: 'Photograph the clue page from your Consulting Detective book.' }),
      (() => {
        const li = document.createElement('li');
        li.innerHTML = 'Upload the photo to <strong>Claude.ai</strong> (or any vision AI) and ask: <em>"Extract all clues. For each clue, put the district code and number on its own line (e.g. SE 8), then the clue text below it. Preserve the original paragraph breaks within each clue by leaving a blank line between paragraphs. Separate one clue from the next the same way."</em>';
        return li;
      })(),
      h('li', { text: 'Copy the response and paste it below.' }),
      h('li', { text: 'Review the parsed clues and remove any errors before saving.' }),
    ),
  );

  const pasteArea = h('textarea', {
    class: 'gm-textarea ci-paste',
    attrs: { placeholder: 'Paste extracted clue text here…\n\nExample:\nSE 8\nThe tobacconist on Portman Street claims…\n\nNW 14\nA young urchin near the docks reported…' },
  }) as HTMLTextAreaElement;

  const parseBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Parse Clues →' });
  const parseErr = h('div', { class: 'form-error' });

  // ── Step 2: review panel (hidden until parse) ──
  const reviewPanel = h('div', { class: 'ci-review' });
  reviewPanel.style.display = 'none';

  let parsedClues: ParsedClue[] = [];

  parseBtn.addEventListener('click', () => {
    parseErr.textContent = '';
    const raw = pasteArea.value;
    if (!raw.trim()) { parseErr.textContent = 'Paste some text first.'; return; }
    parsedClues = parseClues(raw);
    if (!parsedClues.length) {
      parseErr.textContent = 'Could not find any clues. Make sure each clue starts with a district code like "SE 8" on its own line.';
      return;
    }
    renderReview();
    reviewPanel.style.display = '';
  });

  function renderReview(): void {
    replaceChildren(reviewPanel,
      h('div', { class: 'ci-review-header' },
        h('span', { class: 'ci-review-count', text: `${parsedClues.length} clue${parsedClues.length !== 1 ? 's' : ''} found` }),
        h('span', { class: 'ci-review-hint', text: 'Edit or remove before saving.' }),
      ),
      ...parsedClues.map((clue, i) => buildClueCard(clue, i)),
      h('div', { class: 'ci-save-row' },
        buildSaveBtn(),
      ),
    );
  }

  function buildClueCard(clue: ParsedClue, index: number): HTMLElement {
    const locInput = h('input', {
      class: 'gm-input ci-loc-input',
      attrs: { type: 'text', value: clue.location_name, placeholder: 'e.g. SE 8' },
    }) as HTMLInputElement;
    const textArea = h('textarea', {
      class: 'gm-textarea ci-text-input',
      text: clue.clue_text,
      attrs: { placeholder: 'Clue text…' },
    }) as HTMLTextAreaElement;
    const removeBtn = h('button', { class: 'btn btn-danger btn-sm ci-remove-btn', text: '✕' });

    locInput.addEventListener('input', () => { parsedClues[index].location_name = locInput.value; });
    textArea.addEventListener('input', () => { parsedClues[index].clue_text = textArea.value; });
    removeBtn.addEventListener('click', () => {
      parsedClues.splice(index, 1);
      renderReview();
    });

    return h('div', { class: 'ci-clue-card' },
      h('div', { class: 'ci-clue-card-header' },
        locInput,
        removeBtn,
      ),
      textArea,
    );
  }

  function buildSaveBtn(): HTMLElement {
    const saveBtn = h('button', {
      class: 'btn btn-primary',
      text: `Save ${parsedClues.length} Clue${parsedClues.length !== 1 ? 's' : ''}`,
    });
    const saveErr = h('div', { class: 'form-error' });
    const wrap = h('div', {}, saveBtn, saveErr);

    saveBtn.addEventListener('click', async () => {
      const toSave = parsedClues.filter((c) => c.location_name.trim() && c.clue_text.trim());
      if (!toSave.length) { saveErr.textContent = 'No valid clues to save.'; return; }
      saveBtn.setAttribute('disabled', '');
      saveBtn.textContent = 'Saving…';
      try {
        let nextPosition = store.getState().clues.length + 1;
        for (const c of toSave) {
          await clueRepo.create({
            case_id: caseId,
            location_name: c.location_name.trim(),
            clue_text: c.clue_text.trim(),
            image_url: '',
            position: nextPosition++,
          });
        }
        toast(`${toSave.length} clue${toSave.length !== 1 ? 's' : ''} imported.`);
        handle.close();
      } catch {
        saveErr.textContent = 'Could not save clues. Try again.';
        saveBtn.removeAttribute('disabled');
        saveBtn.textContent = `Save ${toSave.length} Clue${toSave.length !== 1 ? 's' : ''}`;
      }
    });

    return wrap;
  }

  body.append(instructions, pasteArea, parseErr, parseBtn, reviewPanel);
}
