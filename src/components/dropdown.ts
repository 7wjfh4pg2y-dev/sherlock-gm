// ── Custom dropdown ──
// Native <select> option popups ignore font-family on macOS (the OS renders the
// list with the system font), so this replaces the select with styled elements
// that honour our typewriter font. Drop-in-ish: setOptions / getValue / setValue
// plus an onChange callback fired only on user selection.

import { h, clear } from '../util/dom';

export interface DropdownOption { value: string; label: string }

export interface DropdownHandle {
  element: HTMLElement;
  setOptions(options: DropdownOption[], selected: string): void;
  getValue(): string;
  setValue(value: string): void;
}

export function createDropdown(opts: {
  onChange: (value: string) => void;
  className?: string;
}): DropdownHandle {
  let options: DropdownOption[] = [];
  let value = '';
  let open = false;

  const label = h('span', { class: 'gm-dropdown-label' });
  const trigger = h('button', {
    class: 'gm-dropdown-trigger' + (opts.className ? ` ${opts.className}` : ''),
    attrs: { type: 'button', 'aria-haspopup': 'listbox' },
  }, label);
  const menu = h('div', { class: 'gm-dropdown-menu', attrs: { role: 'listbox' } });
  const element = h('div', { class: 'gm-dropdown' }, trigger, menu);

  function labelFor(v: string): string {
    return options.find((o) => o.value === v)?.label ?? '';
  }

  function renderTrigger(): void {
    label.textContent = labelFor(value);
  }

  function close(): void {
    if (!open) return;
    open = false;
    menu.classList.remove('show');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function openMenu(): void {
    if (open) return;
    open = true;
    renderMenu();
    menu.classList.add('show');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function onDocMouseDown(e: MouseEvent): void {
    if (!element.contains(e.target as Node)) close();
  }
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { close(); trigger.focus(); }
  }

  function select(v: string): void {
    close();
    if (v === value) return;
    value = v;
    renderTrigger();
    opts.onChange(v);
  }

  function renderMenu(): void {
    clear(menu);
    for (const o of options) {
      menu.append(h('div', {
        class: 'gm-dropdown-option' + (o.value === value ? ' selected' : ''),
        attrs: { role: 'option' },
        on: { click: () => select(o.value) },
      }, o.label));
    }
  }

  trigger.addEventListener('click', () => (open ? close() : openMenu()));

  return {
    element,
    setOptions(next, selected) {
      options = next;
      value = selected;
      renderTrigger();
      if (open) renderMenu();
    },
    getValue: () => value,
    setValue(v) {
      value = v;
      renderTrigger();
      if (open) renderMenu();
    },
  };
}
