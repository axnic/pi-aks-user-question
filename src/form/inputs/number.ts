/**
 * form/inputs/number.ts — Numeric input with cursor editing and slider.
 *
 * Uses the shared Editor for display and cursor management (same mechanism as
 * TextInput). Character insertion is validated via insert-then-revert: we forward
 * the keypress to the Editor and immediately undo it if the resulting text is not
 * a valid number prefix, keeping the Editor buffer always in a valid state.
 *
 * Render:
 *   > 42            ← Editor renders with terminal cursor via its own CURSOR_MARKER
 *   > e.g. 0        ← dim placeholder when buffer is empty (no cursor shown)
 *   0 [──────────●──────] 100       ← slider when both min and max are set
 *
 * Keyboard:
 *   0-9, -, ., e/E   — inserted at cursor (rejected if result is not a valid prefix)
 *   Backspace         — forwarded to Editor
 *   ←/→               — forwarded to Editor (cursor movement)
 *   ↑/↓               — increment/decrement by step (updates Editor text)
 *   Enter             — validate and advance (onAdvance) if valid, else show error
 *
 * Unhandled keys (Tab, Shift+Tab, Escape) return false — Form/Tabs handle them.
 */

import type { Editor } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import { isBorderLine } from "../../helpers";
import type { NumberQuestion } from "../../types";
import {
  BaseInput,
  type FooterHint,
  type InputCallbacks,
  type RenderContext,
} from "./types";

/** Number of track characters between the min and max labels: `min [────●────] max`. */
const SLIDER_WIDTH = 20;

/** Direction for ↑/↓ stepping in the numeric field. */
enum StepDir {
  Up = 1,
  Down = -1,
}

/**
 * Returns true if `text` is a valid number prefix
 * (i.e. a string that could be the start of a valid number).
 *
 * Rules enforced:
 *   - At most one decimal point `.`
 *   - At most one exponent `e` or `E`
 *   - `-` only at position 0 or immediately after `e`/`E`
 *   - No `e`/`E` before any digit appears
 *   - No `.` after `e`/`E` (exponent must be integer)
 */
function isValidNumberString(text: string): boolean {
  if (!/^-?[\d.]*(?:[eE]-?[\d]*)?$/.test(text)) return false;
  if ((text.match(/\./g) || []).length > 1) return false;
  if ((text.match(/[eE]/g) || []).length > 1) return false;
  const eIdx = text.search(/[eE]/);
  if (eIdx >= 0 && text.slice(eIdx + 1).includes(".")) return false;
  return true;
}

/**
 * Returns true if inserting `char` at `pos` into `text` would produce a valid
 * number prefix (i.e. a string that could be the start of a valid number).
 */
export function isValidNumberPrefix(
  text: string,
  char: string,
  pos: number,
): boolean {
  return isValidNumberString(text.slice(0, pos) + char + text.slice(pos));
}

/**
 * Numeric input with cursor editing and optional visual range slider.
 *
 * Uses the shared Editor for buffer and cursor management. The `activate` /
 * `deactivate` lifecycle loads and saves `_rawText` from/to the Editor,
 * exactly as TextInput does with its `_value`.
 *
 * `_rawText` is kept in sync on every valid keypress so that `isAnswered()`
 * and the slider always reflect the current in-progress value without waiting
 * for a Tab or Enter.
 */
export class NumberInput extends BaseInput<"number"> {
  readonly type = "number" as const;

  /** In-progress text buffer — kept in sync with the Editor on every keypress. */
  private _rawText = "";
  private _error: string | undefined;

  constructor(
    private readonly _q: NumberQuestion,
    editor: Editor,
    callbacks: InputCallbacks,
  ) {
    super(editor, callbacks);
  }

  /**
   * Load the committed buffer into the Editor and wire `onSubmit`.
   * Called by Form when this input's tab becomes active.
   */
  activate(): void {
    this._editor.setText(this._rawText);
  }

  /**
   * Persist the Editor text back to `_rawText` and unhook `onSubmit`.
   * Called by Form when this input's tab becomes inactive.
   */
  deactivate(): void {
    this._rawText = this._editor.getText();
  }

  /**
   * Derives the placeholder text shown when the buffer is empty.
   *
   * Priority: explicit `placeholder` → `validation.min` → nothing.
   */
  private _placeholder(): number | undefined {
    if (this._q.placeholder !== undefined) return this._q.placeholder;
    const min = this._q.validation?.min;
    return min !== undefined ? min : undefined;
  }

  /** @inheritdoc */
  handleInput(data: string): boolean {
    if (matchesKey(data, Key.enter)) {
      this._rawText = this._editor.getText();
      const result = this._submitValue();
      if (result) {
        this._callbacks.onAdvance();
      }
      this._callbacks.onRefresh();
      return true;
    }

    // ↑ / ↓ — increment / decrement, then sync Editor.
    if (matchesKey(data, Key.up)) {
      this._rawText = this._editor.getText();
      this._step(StepDir.Up);
      this._editor.setText(this._rawText);
      this._callbacks.onRefresh();
      return true;
    }
    if (matchesKey(data, Key.down)) {
      this._rawText = this._editor.getText();
      this._step(StepDir.Down);
      this._editor.setText(this._rawText);
      this._callbacks.onRefresh();
      return true;
    }

    // Tab / Shift+Tab / Escape — not consumed.
    if (
      matchesKey(data, Key.tab) ||
      matchesKey(data, Key.shift("tab")) ||
      matchesKey(data, Key.escape)
    ) {
      return false;
    }

    // Backspace / ← / → — forwarded to Editor, then sync _rawText.
    if (
      matchesKey(data, Key.backspace) ||
      matchesKey(data, Key.left) ||
      matchesKey(data, Key.right)
    ) {
      this._editor.handleInput(data);
      this._rawText = this._editor.getText();
      this._error = undefined;
      this._callbacks.onRefresh();
      return true;
    }

    // Printable number chars: insert via Editor, revert if result is invalid.
    if (data.length === 1 && /[\d\-.eE]/.test(data)) {
      this._editor.handleInput(data);
      const after = this._editor.getText();
      if (!isValidNumberString(after)) {
        // Undo: backspace removes the char that was just inserted at the cursor.
        this._editor.handleInput("\x7f");
      } else {
        this._rawText = after;
        this._error = undefined;
      }
      this._callbacks.onRefresh();
      return true;
    }

    return false;
  }

  /**
   * Validates `_rawText` and sets `_error` if invalid.
   *
   * @returns `true` if valid (or optional+empty), `false` otherwise (and populates `_error`).
   */
  private _submitValue(): boolean {
    const raw = this._rawText.trim();
    if (!raw) {
      if (this._q.required) {
        this._error = "Please enter a number";
        return false;
      }
      // Optional and empty → clear any previous error and allow advance.
      this._error = undefined;
      return true;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      this._error = this._q.validation?.errorMessage ?? "Invalid number";
      return false;
    }
    const v = this._q.validation;
    if (v?.format === "integer" && !Number.isInteger(n)) {
      this._error =
        v.errorMessage ?? "Invalid format — expected a whole number";
      return false;
    }
    if (v?.min !== undefined && n < v.min) {
      this._error = v.errorMessage ?? `Value must be ≥ ${v.min}`;
      return false;
    }
    if (v?.max !== undefined && n > v.max) {
      this._error = v.errorMessage ?? `Value must be ≤ ${v.max}`;
      return false;
    }
    this._error = undefined;
    return true;
  }

  /**
   * Move value by `step` in `direction`, clamped to `[min, max]`.
   * When the buffer is empty, starts from the placeholder value (if set),
   * or falls back to the appropriate bound or 0.
   * Updates `_rawText`; caller must sync the Editor afterwards.
   */
  private _step(direction: StepDir): void {
    const step = (this._q.step ?? 1) * direction;
    const empty = this._rawText.trim() === "";
    let next: number;

    if (empty) {
      const placeholder = this._placeholder();
      if (placeholder !== undefined) {
        next = placeholder + step;
      } else {
        next =
          direction === StepDir.Up
            ? (this._q.validation?.min ?? 0)
            : (this._q.validation?.max ?? 0);
      }
    } else {
      const current = Number(this._rawText);
      if (!Number.isFinite(current)) {
        next =
          direction === StepDir.Up
            ? (this._q.validation?.min ?? 0)
            : (this._q.validation?.max ?? 0);
      } else {
        next = current + step;
      }
    }

    if (this._q.validation?.min !== undefined)
      next = Math.max(this._q.validation.min, next);
    if (this._q.validation?.max !== undefined)
      next = Math.min(this._q.validation.max, next);

    if (this._q.validation?.format === "integer") {
      this._rawText = String(Math.round(next));
    } else {
      const stepDecimals = (String(this._q.step ?? 1).split(".")[1] || "")
        .length;
      const currentDecimals = empty
        ? 0
        : (this._rawText.trim().split(".")[1] || "").length;
      const decimals = Math.max(stepDecimals, currentDecimals);
      this._rawText =
        decimals > 0 ? String(Number(next.toFixed(decimals))) : String(next);
    }
    this._error = undefined;
  }

  /** @inheritdoc */
  renderWidget(ctx: RenderContext): string[] {
    const { theme, editor, maxW } = ctx;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    // Render via Editor (same pattern as TextInput) so the terminal cursor appears.
    // Use 99999 to prevent word-wrap; CURSOR_MARKER stays on the first line.
    const contentLines = editor.render(99999).filter((l) => !isBorderLine(l));
    const placeholder = this._placeholder();

    if (!editor.getText() && placeholder !== undefined) {
      add(` > ${theme.fg("dim", `${placeholder}`)}`);
    } else {
      add(` > ${contentLines[0] ?? ""}`);
    }

    // Slider — only when both min and max are defined.
    const q = this._q;
    if (q.validation?.min !== undefined && q.validation?.max !== undefined) {
      const raw = this._rawText.trim();
      const n = raw ? Number(raw) : (placeholder ?? q.validation.min);
      const valid = Number.isFinite(n);
      const ratio = valid
        ? Math.max(
            0,
            Math.min(
              1,
              (n - q.validation.min) / (q.validation.max - q.validation.min),
            ),
          )
        : 0;
      const thumbPos = Math.round(ratio * (SLIDER_WIDTH - 1));
      const track =
        theme.fg("dim", "─".repeat(thumbPos)) +
        theme.fg("accent", "●") +
        theme.fg("dim", "─".repeat(SLIDER_WIDTH - 1 - thumbPos));
      const minLabel = theme.fg("dim", String(q.validation.min));
      const maxLabel = theme.fg("dim", String(q.validation.max));
      add(` ${minLabel} [${track}] ${maxLabel}`);
    }

    return lines;
  }

  /** @inheritdoc */
  getTypedValue(): number {
    return Number(this._rawText.trim());
  }

  /** @inheritdoc */
  getReviewValue(): string {
    return this._rawText.trim();
  }

  /** @inheritdoc */
  getFooterHints(): FooterHint[] {
    const step = this._q.step ?? 1;
    return [
      { keys: [Key.up, Key.down], action: `±${step}` },
      { keys: [Key.enter], action: "next" },
    ];
  }

  /** @inheritdoc */
  override getValidationError(): string | undefined {
    return this._error;
  }

  /** @inheritdoc */
  isAnswered(): boolean {
    const raw = this._rawText.trim();
    if (!raw) return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    const v = this._q.validation;
    if (v?.format === "integer" && !Number.isInteger(n)) return false;
    if (v?.min !== undefined && n < v.min) return false;
    if (v?.max !== undefined && n > v.max) return false;
    return true;
  }
}
