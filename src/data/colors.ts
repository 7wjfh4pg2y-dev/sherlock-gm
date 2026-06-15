// ── Player colours ──
// Identity is name-only; colour is derived deterministically from the name hash
// (carried from v1 — same palette, same algorithm, so existing rows still match).

import type { PlayerColor } from './types';

// Eight distinct, bright spectrum hues — chosen to stay legible against both the
// dark UI and the parchment map, and to read as clearly different player markers.
export const PLAYER_COLORS: PlayerColor[] = [
  { label: 'Red', value: '#ff3b30' },
  { label: 'Orange', value: '#ff9500' },
  { label: 'Yellow', value: '#ffd60a' },
  { label: 'Green', value: '#34c759' },
  { label: 'Cyan', value: '#32d6d6' },
  { label: 'Blue', value: '#0a84ff' },
  { label: 'Purple', value: '#bf5af2' },
  { label: 'Magenta', value: '#ff2d95' },
];

export function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]!.value;
}
