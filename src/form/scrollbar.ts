/**
 * form/scrollbar.ts — Shared scrollbar character utility.
 *
 * Used by ChoiceInput to compute the scrollbar character
 * for each row in a scrollable viewport.
 *
 * The character is one of:
 *   ┃  thumb (current scroll position indicator)
 *   │  track (scrollbar background)
 *
 * Arrow indicators (▲/▼) are rendered as separate lines by the callers
 * above/below the scrollbar, not inside it.
 */

import type { Theme } from "./inputs/types";

/**
 * Returns the scrollbar character for a single row within a scrollable viewport.
 *
 * @param rowInVp    - 0-based index of this row within the visible window.
 * @param vpStart    - Index of the first visible item in the full list.
 * @param vpSize     - Number of visible rows.
 * @param total      - Total number of items in the full list.
 * @param theme      - Active color theme.
 * @param thumbColor - Theme color for the thumb character (default "accent").
 * @param trackColor - Theme color for the track character (default "dim").
 */
export function scrollbarChar(
  rowInVp: number,
  vpStart: number,
  vpSize: number,
  total: number,
  theme: Theme,
  thumbColor = "accent",
  trackColor = "dim",
): string {
  const thumbSize = Math.max(1, Math.round((vpSize / total) * vpSize));
  const scrollRange = total - vpSize;
  const thumbStart =
    scrollRange > 0
      ? Math.round((vpStart / scrollRange) * (vpSize - thumbSize))
      : 0;
  const isThumb = rowInVp >= thumbStart && rowInVp < thumbStart + thumbSize;
  return isThumb ? theme.fg(thumbColor, "┃") : theme.fg(trackColor, "│");
}

/** Whether a ▲ arrow should be shown above the scrollbar. */
export function hasScrollUp(vpStart: number): boolean {
  return vpStart > 0;
}

/** Whether a ▼ arrow should be shown below the scrollbar. */
export function hasScrollDown(
  vpStart: number,
  vpSize: number,
  total: number,
): boolean {
  return vpStart + vpSize < total;
}
