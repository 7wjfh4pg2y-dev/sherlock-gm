// ── Player colours ──
// Identity is name-only; colour is derived deterministically from the name hash
// (carried from v1 — same palette, same algorithm, so existing rows still match).

import type { PlayerColor } from './types';

export const PLAYER_COLORS: PlayerColor[] = [
  { label: 'Crimson', value: '#e05555' },
  { label: 'Navy', value: '#5588dd' },
  { label: 'Forest', value: '#55bb55' },
  { label: 'Plum', value: '#cc66cc' },
  { label: 'Teal', value: '#44cccc' },
  { label: 'Amber', value: '#e8a030' },
  { label: 'Sky', value: '#55aaee' },
  { label: 'Coral', value: '#ee7755' },
];

export function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]!.value;
}
