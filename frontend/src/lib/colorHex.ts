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

/** Relative luminance 0–1 for #rrggbb */
export function hexLuminance(raw: string): number {
  const hex = normalizeHex(raw);
  if (!hex) return 0;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Readable text on a given background */
export function contrastText(bg: string, dark = '#222222', light = '#d1d5db'): string {
  return hexLuminance(bg) > 0.55 ? dark : light;
}
