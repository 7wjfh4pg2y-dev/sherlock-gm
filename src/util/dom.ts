// ── DOM helpers ──
// A tiny typed hyperscript. Building DOM as nodes (not innerHTML strings) is
// XSS-safe by construction: text content is always set via textContent, never
// parsed as markup. This replaces v1's escapeHtml-everywhere template literals.

type Child = Node | string | number | null | undefined | false;

// ── Typographic quotes ──
// Case text is imported from books and frequently arrives with straight quotes,
// or worse, the wrong-facing curly glyph at the start of a word (an opening
// quote that looks like a closing one). This re-derives each quote's direction
// from its surrounding context and emits the correct curly glyph. It runs at
// display time only (on textContent), so the stored data stays untouched and
// editing always sees the raw text.
const L_DQUOTE = '“', R_DQUOTE = '”'; // opening / closing double
const L_SQUOTE = '‘', R_SQUOTE = '’'; // opening / closing single

function opensQuote(prev: string): boolean {
  // A quote opens at the start of the text, or after whitespace / an opening
  // bracket / a dash — anything that isn't the tail end of a word.
  return prev === '' || /\s/.test(prev) || '([{<–—“‘'.includes(prev);
}

export function educateQuotes(input: string): string {
  if (!input || !/["'‘’“”]/.test(input)) return input;
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : '';
    if (ch === '"' || ch === L_DQUOTE || ch === R_DQUOTE) {
      out += opensQuote(prev) ? L_DQUOTE : R_DQUOTE;
    } else if (ch === "'" || ch === L_SQUOTE || ch === R_SQUOTE) {
      // After a letter or digit it's an apostrophe (it's, Holmes', the '90s).
      if (/[A-Za-z0-9]/.test(prev)) out += R_SQUOTE;
      // A leading apostrophe before digits is a decade/elision ('90s, 'tis).
      else if (/\d/.test(input[i + 1] ?? '')) out += R_SQUOTE;
      else out += opensQuote(prev) ? L_SQUOTE : R_SQUOTE;
    } else {
      out += ch;
    }
  }
  return out;
}

interface Props {
  class?: string;
  text?: string;
  /** Inline style — reserve for *data-driven* values only (e.g. player colour). */
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  /** Event listeners, e.g. { click: () => ... }. */
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text != null) el.textContent = educateQuotes(props.text);
  if (props.style) Object.assign(el.style, props.style);
  if (props.dataset) for (const [k, v] of Object.entries(props.dataset)) el.dataset[k] = v;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.on) {
    for (const [evt, fn] of Object.entries(props.on)) {
      el.addEventListener(evt, fn as EventListener);
    }
  }
  for (const child of children) appendChild(el, child);
  return el;
}

/** Append a single child, educating quotes on plain text (see educateQuotes). */
function appendChild(node: Node, child: Child): void {
  if (child == null || child === false) return;
  if (typeof child === 'string') node.appendChild(document.createTextNode(educateQuotes(child)));
  else if (typeof child === 'number') node.appendChild(document.createTextNode(String(child)));
  else node.appendChild(child);
}

/** Remove all children of a node. */
export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Replace a node's children with new ones. */
export function replaceChildren(node: Element, ...children: Child[]): void {
  clear(node);
  for (const child of children) appendChild(node, child);
}

/** HH:MM in the viewer's locale, from an ISO timestamp. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "15 March 1895" from a YYYY-MM-DD date string. Parsed as a plain calendar
 *  date (no timezone shift) so the day never drifts across midnight. */
export function formatCaseDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}
