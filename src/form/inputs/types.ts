/**
 * form/inputs/types.ts — Shared interfaces and base class for all Input types.
 *
 * An Input encapsulates one question's interactive widget:
 *   - Keyboard handling (handleInput → boolean)
 *   - Widget rendering (renderWidget → string[])
 *   - Typed value retrieval (getTypedValue)
 *   - Footer hints for keyboard shortcuts
 *   - Validation error state
 *
 * Inputs do NOT manage question metadata (header, description, required).
 * That is handled by Form via FormQuestion wrappers.
 *
 * Side-effects (advance to next question, submit form, request re-render)
 * are communicated via InputCallbacks injected at construction.
 */

import type { Editor, KeyId } from "@mariozechner/pi-tui";
import type { InputType } from "../../types";

/** Maps an InputType string to its native TypeScript value type. */
export type NativeType<T extends InputType> = T extends "text" | "choice"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : T extends "multichoice"
        ? string[]
        : never;

export interface Theme {
  fg(color: string, s: string): string;
  bold(s: string): string;
}

export interface RenderContext {
  theme: Theme;
  editor: Editor;
  maxW: number;
}

/** A keyboard hint entry for the footer. */
export interface FooterHint {
  /** Key identifiers (compatible with pi-tui KeyId). */
  keys: KeyId[];
  /** Human-readable action description. */
  action: string;
}

/** Callbacks injected by Form for side-effects. */
export interface InputCallbacks {
  /** Input is done — advance to next question (or submit if single-question). */
  onAdvance(): void;
  /** Go back to previous question. */
  onRetreat(): void;
  /** Submit the entire form. */
  onSubmit(): void;
  /** Request a re-render. */
  onRefresh(): void;
}

/**
 * Generic Input interface — each input type implements this.
 *
 * @typeParam T - The InputType discriminant ("text", "number", etc.).
 */
export interface Input<T extends InputType = InputType> {
  readonly type: T;

  /**
   * Handle a raw keypress. Returns true if consumed, false if not.
   * Side-effects (advance, submit, etc.) go through InputCallbacks.
   */
  handleInput(data: string): boolean;

  /**
   * Render ONLY the interactive widget (no question header, no footer).
   * Form wraps this with question/description/error/footer.
   */
  renderWidget(ctx: RenderContext): string[];

  /** Returns the typed value (string, number, boolean, or string[]). */
  getTypedValue(): NativeType<T>;

  /** Returns a human-readable string for the review screen. */
  getReviewValue(): string;

  /** Returns structured keyboard hints for the footer. */
  getFooterHints(): FooterHint[];

  /** Returns the current validation error, or undefined if valid. */
  getValidationError(): string | undefined;

  /** True when the input has a committed answer. */
  isAnswered(): boolean;

  /** Cancels pending timers or async operations. Called before the form closes. */
  dispose(): void;
}

/**
 * Abstract base class for Input implementations.
 * Provides shared references (editor, callbacks) and a no-op dispose().
 */
export abstract class BaseInput<T extends InputType = InputType>
  implements Input<T>
{
  abstract readonly type: T;

  constructor(
    protected readonly _editor: Editor,
    protected readonly _callbacks: InputCallbacks,
  ) {}

  abstract handleInput(data: string): boolean;
  abstract renderWidget(ctx: RenderContext): string[];
  abstract getTypedValue(): NativeType<T>;
  abstract getReviewValue(): string;
  abstract getFooterHints(): FooterHint[];
  abstract isAnswered(): boolean;

  getValidationError(): string | undefined {
    return undefined;
  }

  dispose(): void {
    // No-op by default. Override in inputs that have timers.
  }
}
