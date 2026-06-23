// ── Rich text renderer ──
// Supports a small subset of inline markup that can be typed in a plain
// textarea and renders into safe DOM nodes (no innerHTML, no XSS risk):
//
//   **bold**       → <strong>
//   *italic*       → <em>
//   __underline__  → <u>
//   [image]        → inserts the associated image at that position
//
// Line breaks (\n) become <br>. Everything else is plain text, passed through
// educateQuotes. The stored string is never mutated — the transform is purely
// cosmetic, at display time only.
//
// Backward-compatible: text without any markup renders identically to before.

import { educateQuotes } from './dom';

// ── Tokeniser ──

type Token =
  | { k: 'text'; v: string }
  | { k: 'br' }
  | { k: 'image' }
  | { k: 'bold' | 'italic' | 'underline'; children: Token[] };

function tokenise(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let start = 0;

  function flush(to: number): void {
    if (to > start) out.push({ k: 'text', v: s.slice(start, to) });
    start = to;
  }

  while (i < s.length) {
    if (s[i] === '\n') {
      flush(i); out.push({ k: 'br' }); i++; start = i;
    } else if (s.startsWith('[image]', i)) {
      flush(i); out.push({ k: 'image' }); i += 7; start = i;
    } else if (s.startsWith('**', i)) {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) {
        flush(i); out.push({ k: 'bold', children: tokenise(s.slice(i + 2, end)) });
        i = end + 2; start = i;
      } else i++;
    } else if (s.startsWith('__', i)) {
      const end = s.indexOf('__', i + 2);
      if (end !== -1) {
        flush(i); out.push({ k: 'underline', children: tokenise(s.slice(i + 2, end)) });
        i = end + 2; start = i;
      } else i++;
    } else if (s[i] === '*') {
      const end = s.indexOf('*', i + 1);
      if (end !== -1 && !s.startsWith('**', end)) {
        flush(i); out.push({ k: 'italic', children: tokenise(s.slice(i + 1, end)) });
        i = end + 1; start = i;
      } else i++;
    } else {
      i++;
    }
  }
  flush(s.length);
  return out;
}

// ── Renderer ──

function tokensToNodes(
  tokens: Token[],
  imageUrl: string | undefined,
  onImageClick: (() => void) | undefined,
): Node[] {
  const nodes: Node[] = [];
  for (const t of tokens) {
    switch (t.k) {
      case 'text':
        nodes.push(document.createTextNode(educateQuotes(t.v)));
        break;
      case 'br':
        nodes.push(document.createElement('br'));
        break;
      case 'image':
        if (imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.className = 'rich-text-img';
          if (onImageClick) img.addEventListener('click', onImageClick);
          nodes.push(img);
        }
        break;
      case 'bold': {
        const el = document.createElement('strong');
        el.append(...tokensToNodes(t.children, imageUrl, onImageClick));
        nodes.push(el);
        break;
      }
      case 'italic': {
        const el = document.createElement('em');
        el.append(...tokensToNodes(t.children, imageUrl, onImageClick));
        nodes.push(el);
        break;
      }
      case 'underline': {
        const el = document.createElement('u');
        el.append(...tokensToNodes(t.children, imageUrl, onImageClick));
        nodes.push(el);
        break;
      }
    }
  }
  return nodes;
}

/** Render rich text into an array of DOM nodes ready to append to a container.
 *  If `imageUrl` is provided and the text contains `[image]`, the image is
 *  inserted at that position. If `[image]` is absent but `imageUrl` exists the
 *  caller is responsible for appending the image separately (backward-compat). */
export function renderRichText(
  text: string,
  imageUrl?: string,
  onImageClick?: () => void,
): Node[] {
  if (!text) return [];
  return tokensToNodes(tokenise(text), imageUrl, onImageClick);
}

/** True if the text explicitly places the image via `[image]`. */
export function hasImagePlaceholder(text: string): boolean {
  return text.includes('[image]');
}

/** Strip all markup tokens from text (for compact thumbnail display). */
export function stripMarkup(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[image\]/g, '')
    .trim();
}

// ── Format bar ──
// A small B / I / U toolbar that wraps the textarea's current selection
// in the appropriate markers. Returns a <div> to prepend above the textarea.

type BarOpts = {
  /** Show a hint that [image] positions the image inline. */
  imageHint?: boolean;
};

function wrapSelection(ta: HTMLTextAreaElement, open: string, close: string): void {
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  const before = ta.value.slice(0, s);
  const selected = ta.value.slice(s, e);
  const after = ta.value.slice(e);
  ta.value = before + open + selected + close + after;
  ta.focus();
  ta.setSelectionRange(s + open.length, e + open.length);
  // Trigger input event so any live-update listeners fire.
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

export function createFormatBar(ta: HTMLTextAreaElement, opts: BarOpts = {}): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'format-bar';

  const formats: [string, string, string, string][] = [
    ['B', '**', '**', 'Bold  (**text**)'],
    ['I', '*',  '*',  'Italic  (*text*)'],
    ['U', '__', '__', 'Underline  (__text__)'],
  ];
  for (const [label, open, close, title] of formats) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `format-btn format-btn--${label.toLowerCase()}`;
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('mousedown', (e) => {
      // Prevent the textarea from losing focus on click.
      e.preventDefault();
      wrapSelection(ta, open, close);
    });
    bar.append(btn);
  }

  if (opts.imageHint) {
    const hint = document.createElement('span');
    hint.className = 'format-bar-hint';
    hint.textContent = 'Type [image] where you want the image to appear';
    bar.append(hint);
  }

  return bar;
}
