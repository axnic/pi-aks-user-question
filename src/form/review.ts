/**
 * form/review.ts — ReviewScreen component for the review tab.
 *
 * Renders a scrollable list of all form questions and their current answers.
 * When questions exceed the available height, a vertical scrollbar appears on
 * the left and ↑/↓ bindings scroll the list.
 *
 * Layout (scrollable case — | = scrollbar):
 *
 *                                     ← blank
 *  Review your answers:
 *                                     ← blank
 *  ✘ 2 required questions unanswered  ← warning or blank placeholder
 * │ Header 1          → Answer 1      ← scrollbar char + space + content
 * ┃ Header 2          → Answer 2
 * │ Header 3          → Answer 3
 *                                     ← blank padding (stable height)
 *                                     ← blank before hint
 *  Enter submit · Tab/Shift+Tab edit · Esc cancel · ↑/↓ scroll
 */

import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
import type { Theme } from "./inputs/types";
import type { FormQuestion } from "./question";
import { scrollbarChar } from "./scrollbar";

/** Lines consumed by the header block (blank + heading + blank + warning). */
const REVIEW_OVERHEAD_TOP = 4;

/** Lines consumed by the submit area (blank + hint line). */
const REVIEW_OVERHEAD_BOTTOM = 2;

/** Total fixed-overhead lines surrounding the question list. */
const REVIEW_OVERHEAD = REVIEW_OVERHEAD_TOP + REVIEW_OVERHEAD_BOTTOM;

/** Extra columns consumed by the " → " separator and surrounding margins. */
const REVIEW_VALUE_PADDING = 8;

/** Returned by {@link ReviewScreen.handleInput} to describe what happened. */
export type ReviewAction = "submit" | "scrolled" | null;

/**
 * Self-contained review screen component.
 *
 * Owns the scroll offset for the question list and exposes:
 *   - `handleInput` — processes ↑/↓/Enter; returns a {@link ReviewAction}.
 *   - `render`      — produces the full line buffer for the review frame.
 *   - `reset`       — resets scroll to top (called on tab switches).
 */
export class ReviewScreen {
  private _offset = 0;
  /**
   * Cached maxH from the last `render()` call (or REVIEW_MAX_H equivalent as
   * default).  Used by `handleInput()` to compute the max scroll offset so
   * that keyboard navigation stays consistent even before the first render.
   */
  private _maxH: number;

  /**
   * @param _questions   - Normalised question list from the form.
   * @param _theme       - Theme instance for colour and style rendering.
   * @param defaultMaxH  - Height budget to use before the first {@link render}
   *                       call; should match the `REVIEW_MAX_H` constant in
   *                       {@link Form}. Defaults to 15 (same as `REVIEW_MAX_H`).
   */
  constructor(
    private readonly _questions: FormQuestion[],
    private readonly _theme: Theme,
    defaultMaxH = 15,
  ) {
    this._maxH = defaultMaxH;
  }

  /** Current scroll offset (first visible question index). */
  get offset(): number {
    return this._offset;
  }

  /** Resets scroll to the top. Call whenever the review tab becomes active. */
  reset(): void {
    this._offset = 0;
  }

  /**
   * Processes a raw keypress for the review screen.
   *
   * @param data - Raw terminal key event string.
   * @returns
   *   - `"submit"`   — Enter was pressed; Form should submit.
   *   - `"scrolled"` — ↑/↓ moved the list; Form should repaint.
   *   - `null`       — Key not consumed (Tab/Shift+Tab fall through to Tabs).
   */
  handleInput(data: string): ReviewAction {
    if (matchesKey(data, Key.enter)) return "submit";

    const visibleCount = Math.max(1, this._maxH - REVIEW_OVERHEAD);

    if (matchesKey(data, Key.up)) {
      if (this._offset > 0) {
        this._offset--;
        return "scrolled";
      }
      return null;
    }

    if (matchesKey(data, Key.down)) {
      const maxOffset = Math.max(0, this._questions.length - visibleCount);
      if (this._offset < maxOffset) {
        this._offset++;
        return "scrolled";
      }
      return null;
    }

    return null;
  }

  /**
   * Renders the full review screen into a line buffer.
   *
   * @param maxW - Terminal width in columns.
   * @param maxH - Total lines budget for the review content
   *               (visible question rows = `maxH - REVIEW_OVERHEAD` = `maxH - 6`).
   * @returns Array of rendered lines.
   */
  render(maxW: number, maxH: number): string[] {
    const { _theme: theme } = this;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    const total = this._questions.length;
    const visibleCount = Math.max(1, maxH - REVIEW_OVERHEAD);
    this._maxH = maxH;

    // Clamp offset to valid range before rendering.
    const maxOffset = Math.max(0, total - visibleCount);
    if (this._offset > maxOffset) this._offset = maxOffset;

    const scrollable = total > visibleCount;

    // ── Header block ──────────────────────────────────────────────────────────
    lines.push("");
    add(` ${theme.bold(theme.fg("text", "Review your answers:"))}`);
    lines.push("");

    // Warning line (always exactly 1 line — blank placeholder keeps height stable).
    const reqCount = this._questions.filter(
      (fq) => fq.required && !fq.input.isAnswered(),
    ).length;
    const optCount = this._questions.filter(
      (fq) => !fq.required && !fq.input.isAnswered(),
    ).length;
    if (reqCount > 0) {
      add(
        ` ${theme.fg("error", `✘ ${reqCount} required question${reqCount > 1 ? "s" : ""} unanswered`)}`,
      );
    } else if (optCount > 0) {
      add(
        ` ${theme.fg("warning", `⚠ ${optCount} optional question${optCount > 1 ? "s" : ""} unanswered`)}`,
      );
    } else {
      lines.push(""); // stable-height placeholder when all questions are answered
    }

    // ── Question rows ─────────────────────────────────────────────────────────
    const maxHeaderW =
      total > 0
        ? Math.max(...this._questions.map((fq) => visibleWidth(fq.question)))
        : 0;

    // Prefix: "│ " (2 chars) when scrollable, " " (1 char) otherwise.
    const prefixW = scrollable ? 2 : 1;
    const valueMaxW = Math.max(
      1,
      maxW - maxHeaderW - REVIEW_VALUE_PADDING - prefixW,
    );

    const slice = this._questions.slice(
      this._offset,
      this._offset + visibleCount,
    );

    for (let i = 0; i < slice.length; i++) {
      const fq = slice[i]!;
      const answered = fq.input.isAnswered();
      const paddedHeader = fq.question.padEnd(maxHeaderW);

      const valueText = answered
        ? truncateToWidth(fq.input.getReviewValue(), valueMaxW)
        : theme.fg("dim", "(not answered)");

      const headerStyled =
        fq.required && !answered
          ? theme.fg("warning", paddedHeader)
          : theme.fg("accent", paddedHeader);

      const prefix = scrollable
        ? `${scrollbarChar(i, this._offset, visibleCount, total, theme)} `
        : " ";

      add(`${prefix}${headerStyled} ${theme.fg("dim", "→")} ${valueText}`);
    }

    // Pad to visibleCount when scrollable so the frame height stays constant
    // as the user scrolls.  Without scrolling, height naturally tracks total.
    if (scrollable) {
      for (let i = slice.length; i < visibleCount; i++) {
        lines.push("");
      }
    }

    // ── Submit area ───────────────────────────────────────────────────────────
    lines.push("");
    const scrollHint = scrollable ? " · ↑/↓ scroll" : "";
    add(
      ` ${theme.fg("dim", `Enter submit · Tab/Shift+Tab edit · Esc cancel${scrollHint}`)}`,
    );

    return lines;
  }
}
