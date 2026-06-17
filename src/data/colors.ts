// ── Player colours ──
import type { PlayerColor } from './types';

export const PLAYER_COLORS: PlayerColor[] = [
  { label: 'Red',    value: '#ff3b30' },
  { label: 'Orange', value: '#ff9500' },
  { label: 'Amber',  value: '#ffcc00' },
  { label: 'Green',  value: '#34c759' },
  { label: 'Teal',   value: '#5ac8fa' },
  { label: 'Cyan',   value: '#32d6d6' },
  { label: 'Blue',   value: '#0a84ff' },
  { label: 'Indigo', value: '#5856d6' },
  { label: 'Purple', value: '#bf5af2' },
];

export function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]!.value;
}
