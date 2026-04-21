/**
 * form/inputs/choice.ts — Selectable option list input (single or multi-select).
 *
 * Unified implementation for both Choice (single-select) and MultiChoice (multi-select).
 * The `multi` flag controls behavior:
 *
 * Render (identical for both modes):
 *   │ › 1. [✔] TypeScript    ← │ = scrollbar track, ┃ = thumb
 *   ┃   2. [ ] Rust
 *   │   3. [✔] Python
 *   │   4. [ ] Go
 *
 * Keyboard:
 *   ↑/↓    — move cursor
 *   Space  — select option (single) or toggle checkbox (multi); opens Other editor on Other row
 *   Enter  — advance to the next question (always)
 *   Escape — exit Other mode (normal mode: not consumed)
 *
 * Scrollbar shown when options > MAX_VISIBLE_OPTIONS.
 * Viewport is centered on cursor.
 *
 * Single-select (multi=false):
 *   - Space: clear all + select (reset others). A selected choice CANNOT be devalidated.
 *   - Enter: always advances regardless of selection state.
 *
 * Multi-select (multi=true):
 *   - Space: toggle selected/deselected freely.
 *   - Enter: always advances regardless of selection state.
 *
 * Unhandled keys (Tab, ←/→) return false — Form/Tabs handle them.
 */

import type { Editor } from "@mariozechner/pi-tui";
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
import { isBorderLine } from "../../helpers";
import type {
  ChoiceOption,
  ChoiceQuestion,
  MultiChoiceQuestion,
} from "../../types";
import { hasScrollDown, hasScrollUp, scrollbarChar } from "../scrollbar";
import {
  BaseInput,
  type FooterHint,
  type InputCallbacks,
  type RenderContext,
} from "./types";

/** Chars consumed by `"  N. [✔] Other: "` prefix when rendering the inline Other editor. */
const OTHER_EDITOR_PREFIX_W = 12;

/**
 * Selectable option list — unified for single-select and multi-select.
 *
 * The `multi` constructor flag controls behaviour:
 *
 * | Aspect       | `multi = false` (choice)       | `multi = true` (multichoice)   |
 * |--------------|-------------------------------|-------------------------------|
 * | Selection    | clear-all + select one         | toggle freely                 |
 * | Devalidation | not allowed                    | allowed (toggle off)          |
 * | Auto-advance | yes (`onAdvance` after pick)   | no                            |
 * | Return type  | `string`                       | `string[]`                    |
 *
 * Scrollbar is shown when options exceed {@link MAX_VISIBLE_OPTIONS}.
 * The viewport is always centred on the cursor.
 */
export class ChoiceInput extends BaseInput {
  readonly type: "choice" | "multichoice";

  /** Labels currently selected by the user. */
  protected _selected = new Set<string>();
  /** Cursor position in the option list (0-based). */
  protected _cursorIdx = 0;
  /** `true` while the inline "Other..." editor is active. */
  protected _otherMode = false;
  /** Free-text value entered via the "Other..." row. */
  protected _otherText = "";
  /** Whether this is a multi-select (`true`) or single-select (`false`). */
  private readonly _multi: boolean;

  constructor(
    private readonly _q: ChoiceQuestion | MultiChoiceQuestion,
    editor: Editor,
    callbacks: InputCallbacks,
    multi = false,
  ) {
    super(editor, callbacks);
    this._multi = multi;
    this.type = multi ? "multichoice" : "choice";
  }

  /** @inheritdoc */
  handleInput(data: string): boolean {
    if (this._otherMode) {
      return this._handleOtherMode(data);
    }

    // Escape in normal mode → not consumed (Form handles).
    if (matchesKey(data, Key.escape)) return false;

    const total = this._optionCount();

    if (matchesKey(data, Key.up)) {
      this._cursorIdx = Math.max(0, this._cursorIdx - 1);
      this._callbacks.onRefresh();
      return true;
    }
    if (matchesKey(data, Key.down)) {
      this._cursorIdx = Math.min(total - 1, this._cursorIdx + 1);
      this._callbacks.onRefresh();
      return true;
    }

    if (matchesKey(data, Key.space)) {
      const isOtherRow =
        this._q.allowOther !== false &&
        this._cursorIdx === this._q.options.length;
      if (isOtherRow) {
        this._otherMode = true;
        this._editor.setText(this._otherText);
        this._callbacks.onRefresh();
        return true;
      }
      const opt = this._q.options[this._cursorIdx];
      if (opt) {
        if (this._multi) {
          // Multi-select: toggle.
          if (this._selected.has(opt.label)) {
            this._selected.delete(opt.label);
          } else {
            this._selected.add(opt.label);
          }
        } else {
          // Single-select: clear selection + other text, then pick. Cannot devalidate.
          if (!this._selected.has(opt.label)) {
            this._selected.clear();
            this._otherText = ""; // deselect any previous Other entry
            this._selected.add(opt.label);
          }
          // If already selected → do nothing (cannot devalidate).
        }
        this._callbacks.onRefresh();
        return true;
      }
    }

    // Enter: always advance to the next question.
    if (matchesKey(data, Key.enter)) {
      this._callbacks.onAdvance();
      return true;
    }

    return false;
  }

  /**
   * Handles keypresses while the "Other..." inline editor is active.
   * Escape discards, Enter confirms, empty text auto-exits.
   */
  private _handleOtherMode(data: string): boolean {
    if (matchesKey(data, Key.escape)) {
      // Discard and exit Other mode.
      this._otherMode = false;
      this._editor.setText("");
      this._callbacks.onRefresh();
      return true;
    }

    if (matchesKey(data, Key.enter)) {
      const trimmed = this._editor.getText().trim();
      this._otherText = trimmed;
      this._otherMode = false;
      if (!this._multi) {
        this._selected.clear();
      }
      this._editor.setText("");
      this._callbacks.onAdvance();
      return true;
    }

    this._editor.handleInput(data);

    // If the user erased everything, exit Other mode.
    if (!this._editor.getText().trim()) {
      this._otherText = "";
      this._otherMode = false;
      this._editor.setText("");
    }

    this._callbacks.onRefresh();
    return true;
  }

  /** @inheritdoc */
  renderWidget(ctx: RenderContext): string[] {
    const { theme, editor, maxW, maxH } = ctx;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    const total = this._optionCount();
    const scrollable = total > maxH;
    const visibleCount = scrollable ? maxH : total;
    const vp = this._getViewport(visibleCount);
    const vpSize = vp.end - vp.start + 1;
    const options = this._q.options;

    // Width of the widest number label — used to right-align all numbers.
    const maxNumW = String(total).length;

    // Determine whether inline hints fit on the same line.
    const hasAnyHint = options.some((o) => o.description);
    let showHints = false;
    let maxLabelW = 0;
    if (hasAnyHint) {
      maxLabelW = Math.max(...options.map((o) => visibleWidth(o.label)));
      const maxHintW = Math.max(
        ...options
          .filter((o): o is ChoiceOption & { description: string } =>
            Boolean(o.description),
          )
          .map((o) => visibleWidth(o.description)),
      );
      const sbW = scrollable ? 1 : 0;
      // sb + ptr + " " + num(padded) + "." + " " + box + " " + label(padded) + " ─ " + hint
      const prefixW = sbW + 1 + 1 + maxNumW + 1 + 1 + 3 + 1;
      const separatorW = 3; // " ─ "
      showHints = prefixW + maxLabelW + separatorW + maxHintW <= maxW;
    }

    // Reserve a line for ▲: show arrow or blank when scrollable.
    if (scrollable) {
      add(hasScrollUp(vp.start) ? theme.fg("dim", "▲") : " ");
    }

    for (let i = vp.start; i <= vp.end; i++) {
      const rowInVp = i - vp.start;
      const isCursor = i === this._cursorIdx;
      const ptr = isCursor ? theme.fg("accent", "›") : " ";
      const isOtherRow = this._q.allowOther !== false && i === options.length;

      const sb = scrollable
        ? scrollbarChar(rowInVp, vp.start, vpSize, total, theme)
        : "";

      // Right-aligned number: e.g. " 1." or "10."
      const num = String(i + 1).padStart(maxNumW);

      if (isOtherRow) {
        add(
          `${sb}${ptr} ${this._renderOtherRow(i, isCursor, editor, maxW, maxNumW, theme)}`,
        );
      } else {
        const opt = options[i] as ChoiceOption;
        const isChecked = this._selected.has(opt.label);
        const box = isChecked
          ? `[${theme.fg("success", "✔")}]`
          : theme.fg("dim", "[ ]");
        const labelColor = isCursor ? "accent" : isChecked ? "text" : "muted";
        const labelText = theme.fg(labelColor, opt.label);

        if (showHints && opt.description) {
          const padding = " ".repeat(
            Math.max(0, maxLabelW - visibleWidth(opt.label)),
          );
          const separator = theme.fg("dim", "─");
          const hint = theme.fg("dim", opt.description);
          add(
            `${sb}${ptr} ${num}. ${box} ${labelText}${padding} ${separator} ${hint}`,
          );
        } else {
          add(`${sb}${ptr} ${num}. ${box} ${labelText}`);
        }
      }
    }

    // Reserve a line for ▼: show arrow or blank when scrollable.
    if (scrollable) {
      add(hasScrollDown(vp.start, vpSize, total) ? theme.fg("dim", "▼") : " ");
    }

    return lines;
  }

  /** Renders the "Other..." row — shows an inline editor when active, label otherwise. */
  private _renderOtherRow(
    i: number,
    isCursor: boolean,
    editor: Editor,
    maxW: number,
    maxNumW: number,
    theme: RenderContext["theme"],
  ): string {
    const num = String(i + 1).padStart(maxNumW);
    const savedOther = this._otherText.trim();
    if (this._otherMode && isCursor) {
      const editorLine =
        editor
          .render(Math.max(1, maxW - OTHER_EDITOR_PREFIX_W))
          .filter((l) => !isBorderLine(l))
          .join("") || "";
      const box = `[${theme.fg("success", "✔")}]`;
      return `${num}. ${box} ${editorLine}`;
    }
    const otherLabel = savedOther ? `Other: ${savedOther}` : "Other...";
    const otherColor = isCursor ? "accent" : savedOther ? "text" : "dim";
    const box = savedOther
      ? `[${theme.fg("success", "✔")}]`
      : theme.fg("dim", "[ ]");
    return `${num}. ${box} ${theme.fg(otherColor, otherLabel)}`;
  }

  /** Compute viewport of `visibleCount` rows centered on cursor. */
  private _getViewport(visibleCount: number): { start: number; end: number } {
    const total = this._optionCount();
    if (total <= visibleCount) return { start: 0, end: total - 1 };
    const half = Math.floor(visibleCount / 2);
    const start = Math.max(
      0,
      Math.min(this._cursorIdx - half, total - visibleCount),
    );
    return { start, end: start + visibleCount - 1 };
  }

  /**
   * Total number of selectable rows, including the "Other..." row when `allowOther` is set.
   *
   * @returns The count of options plus one if `allowOther` is enabled.
   */
  private _optionCount(): number {
    return this._q.options.length + (this._q.allowOther !== false ? 1 : 0);
  }

  /** @inheritdoc */
  getTypedValue(): string[] | string {
    const sel = [...this._selected];
    const other = this._otherText.trim();
    if (this._multi) {
      return other ? [...sel, other] : sel;
    }
    return other || sel[0] || "";
  }

  /** @inheritdoc */
  getReviewValue(): string {
    const sel = [...this._selected];
    const other = this._otherText.trim();
    if (this._multi) {
      const allParts = other ? [...sel, `${other} (Other)`] : sel;
      return allParts.join(", ");
    }
    if (other) return `${other} (Other)`;
    return sel[0] || "";
  }

  /** @inheritdoc */
  getFooterHints(): FooterHint[] {
    if (this._otherMode) {
      return [
        { keys: [Key.enter], action: "confirm" },
        { keys: [Key.escape], action: "cancel" },
      ];
    }
    return [
      { keys: [Key.up, Key.down], action: "navigate" },
      { keys: [Key.space], action: this._multi ? "toggle" : "select" },
      { keys: [Key.enter], action: "next" },
    ];
  }

  /** @inheritdoc */
  isAnswered(): boolean {
    return this._selected.size > 0 || this._otherText.trim() !== "";
  }
}
