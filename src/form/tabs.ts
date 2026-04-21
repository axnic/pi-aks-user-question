/**
 * form/tabs.ts — Tab bar class for the ask-user-question form.
 *
 * Manages tab navigation state and renders the tab bar with overflow handling.
 * Handles its own keyboard input (Tab/Shift+Tab) internally.
 *
 * Render:
 *   ≺ · Questions │ ✔ Language │ ✦ Answer │ ≡ Review ≻
 *
 * Symbols:
 *   ✔  answered (green)     ·  pending optional (dim)
 *   ✦  pending required (orange)   ≡  review tab (color reflects completion)
 *
 * Active tab:   sym [label]  (with brackets, colored text)
 * Inactive tab: sym  label   (spaces, colored text)
 *
 * Overflow is handled with the expand-from-active algorithm,
 * showing "  …  " ellipsis chips when tabs don't fit.
 */

import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
import type { Theme } from "./inputs/types";
import type { FormQuestion } from "./question";

/**
 * Manages tab navigation state and renders the tab bar for the form.
 *
 * Handles `Tab`/`Shift+Tab` keyboard input internally and notifies the Form
 * via `_onTabChange` so it can manage input activate/deactivate lifecycle.
 * Overflow is handled with an expand-from-active algorithm that replaces
 * off-screen tabs with "  …  " ellipsis chips.
 */
export class Tabs {
  private _activeIdx = 0;
  private _isReview = false;

  constructor(
    private readonly _questions: FormQuestion[],
    private readonly _hasReviewTab: boolean,
    private readonly _onTabChange: (
      oldIdx: number,
      newIdx: number,
      isReview: boolean,
    ) => void,
    private readonly _onRefresh: () => void,
  ) {}

  /** Zero-based index of the currently active question tab. */
  get activeIndex(): number {
    return this._activeIdx;
  }

  /** `true` when the review tab is currently active. */
  get isOnReview(): boolean {
    return this._isReview;
  }

  /** Total number of tabs (questions + optional review tab). */
  get totalTabs(): number {
    return this._questions.length + (this._hasReviewTab ? 1 : 0);
  }

  /**
   * Handle Tab and Shift+Tab. Returns true if consumed.
   * Calls _onTabChange so Form can manage input activate/deactivate.
   */
  handleInput(data: string): boolean {
    if (matchesKey(data, Key.tab)) {
      this._navigate(+1);
      return true;
    }
    if (matchesKey(data, Key.shift("tab"))) {
      this._navigate(-1);
      return true;
    }
    return false;
  }

  /** Navigate directly to a tab index (for tests or review → edit). */
  jumpTo(idx: number): void {
    const total = this.totalTabs;
    const wrapped = ((idx % total) + total) % total;
    const old = this._activeIdx;

    if (this._hasReviewTab && wrapped === this._questions.length) {
      this._isReview = true;
    } else {
      this._isReview = false;
      this._activeIdx = wrapped;
    }

    this._onTabChange(old, wrapped, this._isReview);
    this._onRefresh();
  }

  /** Advance one tab. Called by Input callbacks (onAdvance). */
  advance(): void {
    this._navigate(+1);
  }

  /** Retreat one tab. Called by Input callbacks (onRetreat). */
  retreat(): void {
    this._navigate(-1);
  }

  /**
   * Move one step forward (+1) or backward (−1) with circular wrapping.
   * When the target index equals `_questions.length` and a review tab
   * exists, the review tab is activated instead of a question tab.
   */
  private _navigate(direction: 1 | -1): void {
    const old = this._activeIdx;
    const currentEffective = this._isReview
      ? this._questions.length
      : this._activeIdx;
    const total = this.totalTabs;
    const newIdx = (((currentEffective + direction) % total) + total) % total;

    if (this._hasReviewTab && newIdx === this._questions.length) {
      this._isReview = true;
    } else {
      this._isReview = false;
      this._activeIdx = newIdx;
    }

    this._onTabChange(old, newIdx, this._isReview);
    this._onRefresh();
  }

  /**
   * Render the tab bar string.
   *
   * Uses an **expand-from-active** overflow algorithm: starting from
   * the active tab, it alternately adds tabs to the left and right
   * until the available width is exhausted. Tabs that don't fit are
   * replaced by "  …  " ellipsis chips.
   *
   * @returns A single styled string like `≺ · Q1 │ ✔ Q2 │ ≡ Review ≻`.
   */
  render(theme: Theme, width: number): string {
    const n = this.totalTabs;
    const currentTab = this._isReview
      ? this._questions.length
      : this._activeIdx;

    // Build chip labels: "Header (type)" — header is truncated to fit.
    const MAX_LABEL_W = 20;
    const chipLabels = this._questions.map((fq) =>
      truncateToWidth(fq.header, Math.max(3, MAX_LABEL_W)),
    );

    // Logical width of each chip.
    const chipWidths = chipLabels.map((lbl) => visibleWidth(lbl) + 6);
    if (this._hasReviewTab) {
      chipWidths.push(visibleWidth("Review") + 6);
    }

    const { lo, hi } = this._computeVisibleRange(currentTab, chipWidths, width);

    const reqCount = this._questions.filter(
      (fq) => fq.required && !fq.input.isAnswered(),
    ).length;
    const optCount = this._questions.filter(
      (fq) => !fq.required && !fq.input.isAnswered(),
    ).length;
    const reviewColor =
      reqCount > 0 ? "error" : optCount > 0 ? "warning" : "success";

    const parts: string[] = [];

    if (lo > 0) parts.push(theme.fg("dim", "  …  "));

    for (let i = lo; i <= hi; i++) {
      const active = i === currentTab;
      const isReviewChip = this._hasReviewTab && i === this._questions.length;
      const fq = !isReviewChip ? this._questions[i] : undefined;
      const answered = fq ? fq.input.isAnswered() : false;
      const reqPending = fq ? fq.required && !answered : false;

      const sym = isReviewChip ? "≡" : answered ? "✔" : reqPending ? "✦" : "·";
      const lbl = isReviewChip ? "Review" : chipLabels[i]!;

      const chipColor = isReviewChip
        ? reviewColor
        : answered
          ? "success"
          : reqPending
            ? "warning"
            : "dim";
      const symColored = theme.fg(chipColor, sym);

      let chip: string;
      if (active) {
        chip = ` ${symColored} [${theme.fg("text", lbl)}] `;
      } else {
        chip = ` ${symColored}  ${theme.fg(chipColor, lbl)}  `;
      }

      parts.push(chip);
    }

    if (hi < n - 1) parts.push(theme.fg("dim", "  …  "));

    const hasOverflow = lo > 0 || hi < n - 1;
    const inner = parts.join(theme.fg("dim", "│"));

    if (hasOverflow) {
      // Push arrows to the terminal edges: "≺ " + content (padded) + " ≻"
      const leftArrow = theme.fg("dim", "≺ ");
      const rightArrow = theme.fg("dim", " ≻");
      const arrowW = 4; // "≺ " (2) + " ≻" (2)
      const contentW = visibleWidth(inner);
      const available = Math.max(0, width - arrowW);
      const padding =
        available > contentW ? " ".repeat(available - contentW) : "";
      return leftArrow + inner + padding + rightArrow;
    }

    return theme.fg("dim", " ≺ ") + inner + theme.fg("dim", " ≻");
  }

  /**
   * Computes the visible range [lo, hi] of tab indices using the
   * **expand-from-active** algorithm.
   *
   * Starts from `currentTab` and alternately tries to add one tab to the
   * left and one to the right, each time checking whether the new chip plus
   * its mandatory ellipsis placeholder still fits within `width`.
   * Stops as soon as neither side can grow.
   *
   * When all chips fit, returns [0, n-1] (no overflow, no ellipsis needed).
   *
   * @param currentTab - Index of the active tab (always visible).
   * @param chipWidths - Pre-computed visible widths for every chip.
   * @param width      - Available terminal width for the whole tab bar.
   * @returns `{ lo, hi }` — inclusive indices of the first and last visible chip.
   */
  private _computeVisibleRange(
    currentTab: number,
    chipWidths: number[],
    width: number,
  ): { lo: number; hi: number } {
    const n = chipWidths.length;
    const SEP = 1; // "│" between chips
    const FRAME = 5; // " ≺ " (3) + " ≻" (2)
    const ELLIPSIS_W = 5 + SEP; // "  …  │"

    const totalFull =
      FRAME + chipWidths.reduce((s, w) => s + w, 0) + (n - 1) * SEP;

    if (totalFull <= width) {
      return { lo: 0, hi: n - 1 };
    }

    let lo = currentTab;
    let hi = currentTab;
    let used = chipWidths[currentTab]!;
    let tryL = currentTab - 1;
    let tryR = currentTab + 1;

    while (tryL >= 0 || tryR < n) {
      const leftEllipsis = tryL >= 0 ? ELLIPSIS_W : 0;
      const rightEllipsis = tryR < n ? ELLIPSIS_W : 0;
      let grew = false;

      if (tryL >= 0) {
        const newLeftEllipsis = tryL > 0 ? ELLIPSIS_W : 0;
        if (
          FRAME +
            used +
            chipWidths[tryL]! +
            SEP +
            newLeftEllipsis +
            rightEllipsis <=
          width
        ) {
          lo = tryL;
          used += chipWidths[tryL]! + SEP;
          tryL--;
          grew = true;
        }
      }

      if (tryR < n) {
        const newRightEllipsis = tryR < n - 1 ? ELLIPSIS_W : 0;
        if (
          FRAME +
            used +
            chipWidths[tryR]! +
            SEP +
            leftEllipsis +
            newRightEllipsis <=
          width
        ) {
          hi = tryR;
          used += chipWidths[tryR]! + SEP;
          tryR++;
          grew = true;
        }
      }

      if (!grew) break;
    }

    return { lo, hi };
  }
}
