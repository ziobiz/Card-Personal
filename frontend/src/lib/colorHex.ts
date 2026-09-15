/** Normalize #RGB / #RRGGBB / RGB / RRGGBB → #rrggbb */
export function normalizeHex(raw: string): string | null {
  const s = String(raw || '')
    .trim()
    .replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return null;
}

export function isHexColor(raw: string): boolean {
  return normalizeHex(raw) != null;
}
