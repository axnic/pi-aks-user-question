/**
 * form/inputs/boolean.ts — Yes/No boolean toggle input.
 *
 * Vertical selection with customizable labels and colors.
 * Does NOT use the shared Editor.
 *
 * Render:
 *   ✔ Yes     ← checkmark + trueColor when selected
 *     No      ← dim when not selected
 *
 *     Yes     ← dim when not selected
 *   ✔ No      ← checkmark + falseColor when selected
 *
 * Keyboard:
 *   ↑ / ↓   — toggle between YES and NO
 *   Y        — select YES
 *   N        — select NO
 *   Enter    — confirm current selection → onAdvance()
 *
 * Unhandled keys (Tab, Escape, etc.) return false — Form/Tabs handle them.
 */

import type { Editor } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import type { BooleanQuestion } from "../../types";
import {
  BaseInput,
  type FooterHint,
  type InputCallbacks,
  type RenderContext,
} from "./types";

/**
 * Vertical yes/no toggle input.
 *
 * Labels and colors are customizable via the `true`/`false` fields
 * of {@link BooleanQuestion}. Defaults: "Yes"/"No", success/error.
 *
 * Does **not** use the shared Editor — state is entirely internal.
 */
export class BooleanInput extends BaseInput<"boolean"> {
  readonly type = "boolean" as const;

  /** Current toggle value. Starts at `defaultValue ?? true`. */
  private _value: boolean;
  /** Set to `true` once Enter is pressed. */
  private _answered = false;
  /** Label shown for the "true" option (defaults to "Yes"). */
  private readonly _trueLabel: string;
  /** Label shown for the "false" option (defaults to "No"). */
  private readonly _falseLabel: string;
  /** Theme color used when the "true" option is selected (e.g. "green"). */
  private readonly _trueColor: string;
  /** Theme color used when the "false" option is selected (e.g. "red"). */
  private readonly _falseColor: string;

  constructor(
    private readonly _q: BooleanQuestion,
    editor: Editor,
    callbacks: InputCallbacks,
  ) {
    super(editor, callbacks);
    this._value = _q.defaultValue ?? true;
    this._trueLabel = _q.true?.label ?? "Yes";
    this._falseLabel = _q.false?.label ?? "No";
    this._trueColor = _q.true?.color ?? "success";
    this._falseColor = _q.false?.color ?? "error";
  }

  /** @inheritdoc */
  handleInput(data: string): boolean {
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      this._value = !this._value;
      this._answered = false; // changing the value resets confirmation
      this._callbacks.onRefresh();
      return true;
    }

    if (data === "y" || data === "Y") {
      this._value = true;
      this._answered = false;
      this._callbacks.onRefresh();
      return true;
    }
    if (data === "n" || data === "N") {
      this._value = false;
      this._answered = false;
      this._callbacks.onRefresh();
      return true;
    }

    if (matchesKey(data, Key.enter)) {
      this._answered = true;
      this._callbacks.onAdvance();
      return true;
    }

    return false;
  }

  /** @inheritdoc */
  renderWidget(ctx: RenderContext): string[] {
    const { theme, maxW } = ctx;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    if (this._value) {
      add(
        ` ${theme.fg(this._trueColor, "✔")} ${theme.fg(this._trueColor, theme.bold(this._trueLabel))}`,
      );
      add(`   ${theme.fg("dim", this._falseLabel)}`);
    } else {
      add(`   ${theme.fg("dim", this._trueLabel)}`);
      add(
        ` ${theme.fg(this._falseColor, "✘")} ${theme.fg(this._falseColor, theme.bold(this._falseLabel))}`,
      );
    }

    return lines;
  }

  /** @inheritdoc */
  getTypedValue(): boolean {
    return this._value;
  }

  /** @inheritdoc */
  getReviewValue(): string {
    return this._value ? this._trueLabel : this._falseLabel;
  }

  /** @inheritdoc */
  getFooterHints(): FooterHint[] {
    return [
      { keys: [Key.up, Key.down], action: "choose" },
      { keys: [Key.enter], action: "confirm" },
    ];
  }

  /** @inheritdoc */
  isAnswered(): boolean {
    return this._answered;
  }
}
