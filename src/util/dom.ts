// ── DOM helpers ──
// A tiny typed hyperscript. Building DOM as nodes (not innerHTML strings) is
// XSS-safe by construction: text content is always set via textContent, never
// parsed as markup. This replaces v1's escapeHtml-everywhere template literals.

type Child = Node | string | number | null | undefined | false;

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
  if (props.text != null) el.textContent = props.text;
  if (props.style) Object.assign(el.style, props.style);
  if (props.dataset) for (const [k, v] of Object.entries(props.dataset)) el.dataset[k] = v;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.on) {
    for (const [evt, fn] of Object.entries(props.on)) {
      el.addEventListener(evt, fn as EventListener);
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    el.append(typeof child === 'string' || typeof child === 'number' ? String(child) : child);
  }
  return el;
}

/** Remove all children of a node. */
export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Replace a node's children with new ones. */
export function replaceChildren(node: Element, ...children: Child[]): void {
  clear(node);
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? String(child) : child);
  }
}

/** HH:MM in the viewer's locale, from an ISO timestamp. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
