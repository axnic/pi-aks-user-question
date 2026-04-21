/**
 * form/form.ts — Form class: orchestrates inputs, tab navigation, and lifecycle.
 *
 * Render (multi-question):
 *   ─────────────────────────────────── (hr accent)
 *   ≺ · Q1 │ ✔ Q2 │ ✦ Q3 │ ≡ Review ≻ (tabs)
 *
 *    Question en gras ?                 (question)
 *    Description en dim                 (description, max 4 lines)
 *
 *   <input.renderWidget()>              (widget delegated to input)
 *
 *    ✘ Error message                    (validation error if present)
 *
 *    Enter validate · ↑/↓ navigate      (footer hints from input)
 *    Tab/Shift+Tab switch question      (footer hints from Tabs)
 *    Esc quit                           (always present)
 *   ─────────────────────────────────── (hr accent)
 *
 * Render (single-question):
 *   Same but without the tab bar.
 *
 * Keyboard chaining:
 *   1. Exit confirm dialog (if active) → Y/Enter=quit, other=dismiss
 *   2. Active input tries to handle → if consumed, refresh
 *   3. Tabs tries Tab/Shift+Tab → if consumed, stop
 *   4. Escape (unhandled) → show exit confirmation
 */

import type { Editor } from "@mariozechner/pi-tui";
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import type { Answer, FormResult, InputValue, Question } from "../types";
import type {
  Input,
  InputCallbacks,
  RenderContext,
  Theme,
} from "./inputs/types";
import type { FormQuestion } from "./question";
import { Tabs } from "./tabs";

/** Extra columns reserved for the `" → "` separator and margins in review rows. */
const REVIEW_VALUE_PADDING = 8;

/**
 * Default max visible option rows for scrollable input widgets.
 * Static for now; can later be derived from terminal / window height.
 */
const WIDGET_MAX_H = 4;

/**
 * Maximum number of question rows shown at once in the review screen.
 * Keeping the review at a fixed height prevents the tab bar from shifting
 * as the user navigates between input tabs (which render fewer lines) and
 * the review tab (which could render arbitrarily many).
 */
const REVIEW_MAX_VISIBLE = 8;

/**
 * Orchestrates the interactive form: input lifecycle, tab navigation,
 * review screen, exit confirmation, and final answer collection.
 *
 * Responsibilities:
 *   - Activates/deactivates inputs on tab switches.
 *   - Delegates keyboard events to the active input, then to {@link Tabs}.
 *   - Renders the appropriate frame (input, review, or exit confirmation).
 *   - Calls `done` with a {@link FormResult} on submit or cancel.
 */
export class Form {
  private readonly _tabs: Tabs;
  private readonly _questions: FormQuestion[];
  private _showExitConfirm = false;
  /** Which option is highlighted in the exit dialog: true = Y (quit), false = N (continue). */
  private _exitSelection = true;
  private _cachedLines: string[] | undefined;
  /** Width used for the current `_cachedLines` — cache is invalidated on resize. */
  private _cachedWidth: number | undefined;
  /** Current scroll offset for the review screen (first visible question row index). */
  private _reviewScrollOffset = 0;

  /** `true` when the form contains more than one question (shows tab bar). */
  get isMulti(): boolean {
    return this._questions.length > 1;
  }

  /** The {@link FormQuestion} whose input is currently focused. */
  get activeQuestion(): FormQuestion {
    return this._questions[this._tabs.activeIndex]!;
  }

  /**
   * @param questions       - Ordered list of questions with their inputs.
   * @param _editor         - Shared Editor instance (passed through to inputs).
   * @param _theme          - Active color theme.
   * @param _requestRender  - Callback that asks the TUI to repaint.
   * @param _done           - Callback invoked with the final {@link FormResult}.
   */
  constructor(
    questions: FormQuestion[],
    private readonly _editor: Editor,
    private readonly _theme: Theme,
    private readonly _requestRender: () => void,
    private readonly _done: (result: FormResult) => void,
  ) {
    this._questions = questions;

    // Wire onTabChange to manage input lifecycle.
    this._tabs = new Tabs(
      questions,
      this.isMulti,
      (oldIdx, newIdx, isReview) => {
        // Deactivate old input.
        if (oldIdx < questions.length) {
          this._deactivateInput(questions[oldIdx]!.input);
        }
        // Activate new input.
        if (!isReview && newIdx < questions.length) {
          this._activateInput(questions[newIdx]!.input);
        }
        // Reset review scroll whenever the tab changes.
        this._reviewScrollOffset = 0;
      },
      () => this._refresh(),
    );

    // Activate the first input.
    if (questions.length > 0) {
      this._activateInput(questions[0]!.input);
    }
  }

  /**
   * Main keypress handler — called by the TUI for every keystroke.
   *
   * Delegation order:
   *  1. Exit confirmation dialog (if active)
   *  2. Active input widget
   *  3. Review screen (Enter submits, ↑/↓ scroll)
   *  4. Tabs (Tab / Shift+Tab)
   *  5. Escape → show exit confirmation
   *
   * @param data - Raw terminal key event (e.g. `"\r"`, `"\x1b[A"`, `"a"`).
   */
  handleInput(data: string): void {
    // 1. Exit confirmation dialog.
    if (this._showExitConfirm) {
      if (matchesKey(data, Key.left) || matchesKey(data, Key.right)) {
        this._exitSelection = !this._exitSelection;
        this._refresh();
        return;
      }
      if (data === "y" || data === "Y") {
        this._collectAndFinish(true);
        return;
      }
      if (data === "n" || data === "N") {
        this._showExitConfirm = false;
        this._exitSelection = true;
        this._refresh();
        return;
      }
      if (matchesKey(data, Key.enter)) {
        if (this._exitSelection) {
          this._collectAndFinish(true);
        } else {
          this._showExitConfirm = false;
          this._exitSelection = true;
          this._refresh();
        }
        return;
      }
      // Any other key: dismiss.
      this._showExitConfirm = false;
      this._exitSelection = true;
      this._refresh();
      return;
    }

    // 2. Delegate to active input (if not on review).
    if (!this._tabs.isOnReview) {
      if (this.activeQuestion.input.handleInput(data)) {
        this._refresh();
        return;
      }
    }

    // 3. Review screen.
    if (this._tabs.isOnReview) {
      if (matchesKey(data, Key.enter)) {
        this._collectAndFinish(false);
        return;
      }
      if (matchesKey(data, Key.up)) {
        if (this._reviewScrollOffset > 0) {
          this._reviewScrollOffset--;
          this._refresh();
        }
        return;
      }
      if (matchesKey(data, Key.down)) {
        const maxOffset = Math.max(
          0,
          this._questions.length - REVIEW_MAX_VISIBLE,
        );
        if (this._reviewScrollOffset < maxOffset) {
          this._reviewScrollOffset++;
          this._refresh();
        }
        return;
      }
      // Tab/Shift+Tab handled by Tabs below.
    }

    // 4. Tabs handles Tab/Shift+Tab.
    if (this.isMulti && this._tabs.handleInput(data)) {
      return; // Tabs manages its own refresh.
    }

    // 5. Escape (not consumed by anyone) → exit confirmation.
    if (matchesKey(data, Key.escape)) {
      this._showExitConfirm = true;
      this._refresh();
      return;
    }
  }

  /**
   * Render the form frame. Returns cached lines when state has not changed at the same width.
   *
   * @param width - Terminal width in columns.
   * @returns Array of rendered lines (one string per row).
   */
  render(width: number): string[] {
    if (this._cachedLines && this._cachedWidth === width)
      return this._cachedLines;

    const lines: string[] = [];
    const maxW = width;
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));
    const hr = () => add(this._theme.fg("accent", "─".repeat(maxW)));

    hr();

    // Tabs (if multi-question).
    if (this.isMulti) {
      add(this._tabs.render(this._theme, maxW));
      lines.push("");
    }

    if (this._showExitConfirm) {
      lines.push(...this._renderExitConfirm(maxW));
    } else if (this._tabs.isOnReview) {
      lines.push(...this._renderReviewScreen(maxW));
    } else {
      lines.push(...this._renderInputFrame(this._tabs.activeIndex, maxW));
    }

    hr();
    this._cachedWidth = width;
    this._cachedLines = lines;
    return lines;
  }

  /** Clears the render cache and requests a repaint. */
  invalidate(): void {
    this._cachedLines = undefined;
    this._cachedWidth = undefined;
    this._requestRender();
  }

  // ── Input lifecycle ───────────────────────────────────────────────────────────

  /**
   * Duck-typed call to `input.activate()` when it exists (TextInput).
   * Other inputs have no lifecycle hooks.
   */
  private _activateInput(input: Input): void {
    if ("activate" in input && typeof input.activate === "function") {
      (input as { activate(): void }).activate();
    }
  }

  /** Duck-typed call to `input.deactivate()` — saves in-progress editor text. */
  private _deactivateInput(input: Input): void {
    if ("deactivate" in input && typeof input.deactivate === "function") {
      (input as { deactivate(): void }).deactivate();
    }
  }

  // ── Input frame rendering ─────────────────────────────────────────────────────

  /**
   * Renders the full frame for a question: question + description + widget + error + footer.
   */
  private _renderInputFrame(idx: number, maxW: number): string[] {
    const fq = this._questions[idx]!;
    const input = fq.input;
    const { _theme: theme } = this;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    // Question.
    lines.push("");
    add(` ${theme.bold(theme.fg("text", fq.question))}`);

    // Description (max 4 lines, word-wrapped to fit terminal width).
    if (fq.description) {
      const descLines = wrapTextWithAnsi(fq.description, Math.max(1, maxW - 1));
      for (const dline of descLines.slice(0, 4)) {
        add(` ${theme.fg("dim", dline)}`);
      }
    }

    lines.push("");

    // Widget (delegated to input).
    const ctx: RenderContext = {
      theme: this._theme,
      editor: this._editor,
      maxW,
      maxH: WIDGET_MAX_H,
    };
    lines.push(...input.renderWidget(ctx));

    // Validation error.
    const err = input.getValidationError();
    if (err) {
      lines.push("");
      add(` ${theme.fg("error", `✘ ${err}`)}`);
    }

    // Footer hints.
    lines.push(...this._renderFooterHints(input, maxW));

    return lines;
  }

  // ── Footer hints ──────────────────────────────────────────────────────────────

  /**
   * Builds the footer hint line from the active input's hints plus global shortcuts.
   *
   * @param input - The currently active input (provides its own hint entries).
   * @param maxW  - Maximum rendered width in columns.
   * @returns Two lines: an empty separator and the formatted hint string.
   */
  private _renderFooterHints(input: Input, maxW: number): string[] {
    const { _theme: theme } = this;
    const hints = input.getFooterHints();
    const parts: string[] = [];

    for (const h of hints) {
      const keyStr = h.keys.map((k) => formatKeyId(k)).join("/");
      parts.push(`${keyStr} ${h.action}`);
    }

    if (this.isMulti) {
      parts.push("Tab/Shift+Tab switch question");
    }

    parts.push("Esc quit");

    return [
      "",
      truncateToWidth(` ${theme.fg("dim", parts.join(" · "))}`, maxW),
    ];
  }

  // ── Exit confirmation ─────────────────────────────────────────────────────────

  /**
   * Renders the "[Y]es / [N]o" exit confirmation dialog.
   *
   * @param maxW - Maximum rendered width in columns.
   * @returns Lines for the confirmation prompt.
   */
  private _renderExitConfirm(maxW: number): string[] {
    const { _theme: theme } = this;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    lines.push("");
    add(` ${theme.fg("warning", "⚠ Are you sure you want to quit?")}`);
    add(`   ${theme.fg("dim", "All answers will be lost.")}`);
    lines.push("");
    const yStyled = this._exitSelection
      ? theme.bold(theme.fg("text", "[Y]es, quit"))
      : theme.fg("dim", "[Y]es, quit");
    const nStyled = !this._exitSelection
      ? theme.bold(theme.fg("text", "[N]o, continue"))
      : theme.fg("dim", "[N]o, continue");
    add(` ${yStyled}  ${theme.fg("dim", "·")}  ${nStyled}`);

    return lines;
  }

  // ── Review screen ─────────────────────────────────────────────────────────────

  /**
   * Renders the review screen showing all answers and completion warnings.
   *
   * Shows at most {@link REVIEW_MAX_VISIBLE} question rows at once.  When
   * there are more questions, ↑/↓ scroll indicators appear and the body is
   * always padded to exactly {@link REVIEW_MAX_VISIBLE} rows so the frame
   * height stays constant and the tab bar never shifts.
   *
   * @param maxW - Maximum rendered width in columns.
   * @returns Lines for the review screen.
   */
  private _renderReviewScreen(maxW: number): string[] {
    const { _theme: theme } = this;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    const reqCount = this._questions.filter(
      (fq) => fq.required && !fq.input.isAnswered(),
    ).length;
    const optCount = this._questions.filter(
      (fq) => !fq.required && !fq.input.isAnswered(),
    ).length;

    lines.push("");
    add(` ${theme.bold(theme.fg("text", "Review your answers:"))}`);
    lines.push("");

    // Always emit exactly 2 lines for the warning block (message + blank)
    // so the review frame height stays constant regardless of answer state.
    if (reqCount > 0) {
      add(
        ` ${theme.fg("error", `✘ You have ${reqCount} unanswered required question${reqCount > 1 ? "s" : ""}`)}`,
      );
    } else if (optCount > 0) {
      add(
        ` ${theme.fg("warning", `⚠ You have ${optCount} unanswered question${optCount > 1 ? "s" : ""}`)}`,
      );
    } else {
      lines.push(""); // placeholder — keeps height constant when all answered
    }
    lines.push("");

    const maxHeaderW = Math.max(
      ...this._questions.map((fq) => visibleWidth(fq.header)),
    );

    const total = this._questions.length;
    const offset = this._reviewScrollOffset;
    const visible = Math.min(REVIEW_MAX_VISIBLE, total);
    const canScrollUp = offset > 0;
    const canScrollDown = offset + REVIEW_MAX_VISIBLE < total;

    // Scroll-up indicator.
    add(canScrollUp ? theme.fg("dim", ` ↑ ${offset} more above`) : "");

    // Render the visible slice.
    const slice = this._questions.slice(offset, offset + visible);
    for (const fq of slice) {
      const input = fq.input;
      const answered = input.isAnswered();
      const reqUnanswered = fq.required && !answered;
      const paddedHeader = fq.header.padEnd(maxHeaderW);

      const valueText = answered
        ? truncateToWidth(
            input.getReviewValue(),
            maxW - maxHeaderW - REVIEW_VALUE_PADDING,
          )
        : theme.fg("dim", "(not answered)");

      const headerStyled = reqUnanswered
        ? theme.fg("warning", paddedHeader)
        : theme.bold(theme.fg("text", paddedHeader));

      add(` ${headerStyled} ${theme.fg("dim", "→")} ${valueText}`);
    }

    // Pad to REVIEW_MAX_VISIBLE only when scrolling is active (total > max).
    // With fewer questions, show them naturally without extra blank lines.
    if (total > REVIEW_MAX_VISIBLE) {
      const rendered = slice.length;
      for (let i = rendered; i < REVIEW_MAX_VISIBLE; i++) {
        lines.push("");
      }
    }

    // Scroll-down indicator.
    const remaining = total - offset - visible;
    add(canScrollDown ? theme.fg("dim", ` ↓ ${remaining} more below`) : "");

    lines.push("");
    const scrollHint = total > REVIEW_MAX_VISIBLE ? " · ↑/↓ scroll" : "";
    add(
      theme.fg(
        "dim",
        ` Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel${scrollHint}`,
      ),
    );
    return lines;
  }

  // ── Collect and finish ────────────────────────────────────────────────────────

  /**
   * Dispose all inputs, collect typed answers from each FormQuestion,
   * and invoke the `done` callback. Called on submit or cancel.
   *
   * Each {@link Answer} carries:
   *   - `questionId` — the 0-based index of the question in the original array.
   *   - `value`      — the typed answer, or `null` if the question was skipped.
   */
  private _collectAndFinish(cancelled: boolean): void {
    for (const fq of this._questions) {
      this._deactivateInput(fq.input);
      fq.input.dispose();
    }

    const answers: Answer[] = this._questions.map((fq, idx) => ({
      questionId: fq.questionIdx ?? idx,
      value: fq.input.isAnswered()
        ? (fq.input.getTypedValue() as InputValue)
        : null,
    }));

    const questions = this._questions.map(
      (fq) =>
        fq.originalQuestion ?? {
          id: fq.header,
          type: fq.input.type,
          question: fq.question,
          header: fq.header,
        },
    ) as Question[];

    this._done({ questions, answers, cancelled });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /** Clears the render cache and requests a repaint. */
  private _refresh(): void {
    this._cachedLines = undefined;
    this._cachedWidth = undefined;
    this._requestRender();
  }

  /**
   * Creates an {@link InputCallbacks} object wired to this Form's navigation.
   *
   * `onAdvance` advances or submits (single-question), `onRetreat` retreats,
   * `onSubmit` submits unconditionally, and `onRefresh` requests a repaint.
   *
   * @returns The callbacks object to inject into each Input at construction time.
   */
  createCallbacks(): InputCallbacks {
    return {
      onAdvance: () => {
        if (this.isMulti) {
          // Multi-question: never auto-advance — the user navigates with Tab.
          this._refresh();
        } else {
          this._collectAndFinish(false);
        }
      },
      onRetreat: () => {
        if (this.isMulti) {
          this._tabs.retreat();
        }
      },
      onSubmit: () => {
        this._collectAndFinish(false);
      },
      onRefresh: () => {
        this._refresh();
      },
    };
  }
}

/**
 * Converts a pi-tui {@link KeyId} to a human-readable string.
 *
 * @example
 * formatKeyId("up")        // "↑"
 * formatKeyId("shift+tab") // "Shift+Tab"
 */
function formatKeyId(keyId: string): string {
  const map: Record<string, string> = {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    enter: "Enter",
    escape: "Esc",
    tab: "Tab",
    space: "Space",
    backspace: "⌫",
  };
  // Handle modified keys like "shift+tab".
  if (keyId.includes("+")) {
    const parts = keyId.split("+");
    const base = parts[parts.length - 1]!;
    const modifiers = parts.slice(0, -1);
    const formattedBase = map[base] ?? base;
    return [
      ...modifiers.map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
      formattedBase,
    ].join("+");
  }
  return map[keyId] ?? keyId;
}
