/**
 * form/inputs/text.ts — Single-line free-form text input.
 *
 * Uses the shared Editor for display and editing.
 * Supports optional format validation (url, email, ip, number, regex, etc.)
 * with a debounced live-feedback error message.
 *
 * Render:
 *   > typed text here     ← inline editor (terminal cursor via Editor)
 *   > placeholder dim     ← when empty
 *
 * Keyboard:
 *   Tab/Shift+Tab → not consumed (Tabs handles navigation)
 *   Escape        → not consumed (Form handles exit confirmation)
 *   Shift+Enter   → blocked (\n consumed silently — single-line input)
 *   Enter         → validate and advance (onAdvance) if valid
 *   Other keys    → forwarded to the Editor
 *
 * Lifecycle:
 *   {@link activate}   — loads committed value into Editor, wires onSubmit.
 *   {@link deactivate} — saves Editor text; clears dirty flag when text is
 *                        empty or passes validation so the tab bar updates
 *                        to ✔ immediately without requiring Enter.
 *                        Also cancels any pending debounce timer.
 *
 * ValidationConfig is debounced {@link VALIDATION_DEBOUNCE_MS}ms after last
 * keystroke to avoid flickering on fast typing.
 */

import type { Editor } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import { isBorderLine } from "../../helpers";
import type { TextQuestion } from "../../types";
import { type StringValidationConfig, validate } from "../../validation";
import { BaseInput, type FooterHint, type InputCallbacks, type RenderContext } from "./types";

/** ms of inactivity before live validation feedback appears. */
export const VALIDATION_DEBOUNCE_MS = 250;

/**
 * Single-line text input with optional format validation.
 *
 * Uses the shared {@link Editor} for rendering and cursor management.
 * Lifecycle: {@link activate} loads the saved value into the Editor,
 * {@link deactivate} saves it back — Form calls these on tab switches.
 */
export class TextInput extends BaseInput<"text"> {
  readonly type = "text" as const;

  /** Committed value — only set on submit or deactivate. */
  protected _value = "";
  /** Current validation error message, or `undefined` if valid / not yet checked. */
  protected _error: string | undefined;
  /** Debounce timer for live validation feedback (cleared on deactivate/submit). */
  protected _debounceTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * True when the editor has been modified since the last successful submit.
   * While dirty, `isAnswered()` returns false so the tab indicator reflects
   * the uncommitted state — even if `_value` holds a previously valid answer.
   */
  private _isDirty = false;

  constructor(
    protected readonly _q: TextQuestion,
    editor: Editor,
    callbacks: InputCallbacks,
  ) {
    super(editor, callbacks);
  }

  /** Shorthand for the optional validation config attached to this question. */
  private get _validation(): StringValidationConfig | undefined {
    return this._q.validation;
  }

  /**
   * Restore the saved value into the Editor and wire `onSubmit`.
   * Called by Form when this input's tab becomes active.
   */
  activate(): void {
    this._isDirty = false; // editor will match _value after load
    this._editor.setText(this._value);
    this._editor.onSubmit = () => this._submit();
  }

  /**
   * Persist the current Editor text and unhook `onSubmit`.
   * Called by Form when this input's tab becomes inactive.
   *
   * Kills any pending debounce timer — the shared editor will be used by a
   * different input next, and a stale timer firing would validate the wrong text.
   *
   * Clears `_isDirty` when the saved text is either empty or passes validation
   * so that the tab bar updates to ✔ immediately on tab switch.
   */
  deactivate(): void {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = undefined;

    const text = this._editor.getText().split("\n")[0]!.trim();
    this._value = text;
    this._editor.onSubmit = undefined;

    // Clear dirty → tab bar reflects answered state without requiring Enter.
    // Keep dirty only when text is present AND validation exists AND fails.
    const v = this._validation;
    if (!text || !v || validate(text, v) === null) {
      this._isDirty = false;
    }
  }

  /** @inheritdoc */
  handleInput(data: string): boolean {
    // Tab/Shift+Tab → not consumed (Tabs handles navigation).
    if (matchesKey(data, Key.tab) || matchesKey(data, Key.shift("tab"))) {
      return false;
    }

    // Escape → not consumed (Form handles exit confirmation).
    if (matchesKey(data, Key.escape)) return false;

    // Enter → validate and submit.
    if (matchesKey(data, Key.enter)) {
      this._submit();
      return true;
    }

    // All other keys → forward to the editor.
    // Block \n (Shift+Enter) — this is a single-line input.
    if (data === "\n") return true;
    this._editor.handleInput(data);
    this._isDirty = true; // uncommitted change — tab indicator goes pending

    // Clear error immediately for responsive visual feedback.
    this._error = undefined;
    if (this._validation) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = undefined;
        const text = this._editor.getText().trim();
        if (text) {
          this._error = validate(text, this._validation!) ?? undefined;
        }
        this._callbacks.onRefresh();
      }, VALIDATION_DEBOUNCE_MS);
    }

    this._callbacks.onRefresh();
    return true;
  }

  /**
   * Validate the Editor text and, if valid, commit it and advance.
   * If invalid, store the error and refresh without advancing.
   */
  private _submit(): void {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = undefined;

    const trimmed = this._editor.getText().split("\n")[0]!.trim();
    const v = this._validation;
    if (v && trimmed) {
      const err = validate(trimmed, v);
      if (err) {
        this._error = err;
        this._callbacks.onRefresh();
        return;
      }
    }
    this._error = undefined;
    this._isDirty = false; // successfully confirmed — tab indicator goes green
    this._value = trimmed;
    this._callbacks.onAdvance();
  }

  /** @inheritdoc */
  renderWidget(ctx: RenderContext): string[] {
    const { theme, editor, maxW } = ctx;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, maxW));

    const contentLines = editor
      .render(99999) // avoid word-wrap so CURSOR_MARKER stays on line 0
      .filter((l) => !isBorderLine(l));

    if (!editor.getText() && this._q.placeholder) {
      add(` > ${theme.fg("dim", this._q.placeholder)}`);
    } else {
      // Single-line input: always display only the first content line.
      // The editor may produce multiple visual lines on long text, but we
      // intentionally clip to one — newlines are blocked in handleInput().
      add(` > ${contentLines[0] ?? ""}`);
    }

    return lines;
  }

  /** @inheritdoc */
  getTypedValue(): string {
    return this._value;
  }

  /** @inheritdoc */
  getReviewValue(): string {
    return this._value;
  }

  /** @inheritdoc */
  getFooterHints(): FooterHint[] {
    return [{ keys: [Key.enter], action: "validate" }];
  }

  /** @inheritdoc */
  override getValidationError(): string | undefined {
    return this._error;
  }

  /** @inheritdoc */
  isAnswered(): boolean {
    if (this._isDirty) return false; // uncommitted changes → show as pending
    if (!this._value.trim()) return false;
    const v = this._validation;
    if (v) return validate(this._value.trim(), v) === null;
    return true;
  }

  /** @inheritdoc */
  override dispose(): void {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = undefined;
  }
}
