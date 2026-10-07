/**
 * WCAG contrast helpers for text drawn on a colour we don't control per scheme
 * (the group colours). Pure module so vitest can import it in plain Node.
 */

const BLACK = '#000000';
const WHITE = '#ffffff';

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Black or white, whichever reads better on `fill`. A fixed light/dark list per
 * group drifts when a colour changes; this follows the colour itself (#322:
 * white on Light Blue was 1.4:1).
 */
export function textColorOn(fill: string): string {
  return contrastRatio(BLACK, fill) >= contrastRatio(WHITE, fill) ? BLACK : WHITE;
}
