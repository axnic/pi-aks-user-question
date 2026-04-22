/**
 * types.ts — Shared TypeScript types for the ask-user-question extension.
 *
 * Question types and their option shapes are derived from the TypeBox schemas
 * in schema.ts via `Static<typeof XxxSchema>`, keeping runtime schemas and
 * compile-time types in sync automatically.
 *
 * ValidationConfig is re-exported from validation.ts — no duplication here.
 *
 * Types defined here:
 *   ChoiceOption                — selectable option in a choice/multichoice list
 *
 * Note: `id` is required on all question types — the LLM must always provide it.
 * It is used to correlate answers back to questions in FormResult.
 *   BooleanCustomizableOption   — label/color for one side of a boolean toggle
 *   TextQuestion                — type = "text"
 *   NumberQuestion              — type = "number"
 *   ChoiceQuestion              — type = "choice"
 *   MultiChoiceQuestion         — type = "multichoice"
 *   BooleanQuestion             — type = "boolean"
 *   Question                    — discriminated union of all question types
 *   ValidationConfig            — re-exported from validation.ts
 *   InputType                   — union of all type discriminants
 *   InputTypeValueMap           — maps each InputType to its native TS value
 *   InputValue                  — union of all possible values (for runtime code)
 *   Answer<T>                   — { questionId, value } with value typed by T
 *   FormResult                  — full result passed to done() on form close
 */

import type { Static } from "typebox";
import type {
  BooleanCustomizableOptionSchema,
  BooleanQuestionSchema,
  ChoiceOptionSchema,
  ChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
  NumberQuestionSchema,
  QuestionSchema,
  TextQuestionSchema,
} from "./schema";

// ── Re-export ─────────────────────────────────────────────────────────────────

/** Validation configuration — see validation.ts for the full discriminated union. */
export type { StringValidationConfig as ValidationConfig } from "./validation";

// ── Option shapes (derived from schema) ───────────────────────────────────────

/** A selectable option in a {@link ChoiceQuestion} or {@link MultiChoiceQuestion}. */
export type ChoiceOption = Static<typeof ChoiceOptionSchema>;

/**
 * Customizable label and theme color for one side of a {@link BooleanQuestion} toggle.
 * Defaults: `{ label: "Yes", color: "success" }` / `{ label: "No", color: "error" }`.
 */
export type BooleanCustomizableOption = Static<
  typeof BooleanCustomizableOptionSchema
>;

// ── Question types (derived from schema) ──────────────────────────────────────

/**
 * Single-line free-form text input with optional format validation.
 * Supports url, email, ip, ipv4, ipv6, number, integer, regex formats.
 */
export type TextQuestion = Static<typeof TextQuestionSchema>;

/**
 * Numeric input with optional ←/→ increment/decrement and a visual slider
 * when both `min` and `max` are provided.
 */
export type NumberQuestion = Static<typeof NumberQuestionSchema>;

/**
 * Single-select numbered list — auto-advances to the next question after selection.
 * Set `allowOther: false` only when the option list is exhaustive.
 */
export type ChoiceQuestion = Static<typeof ChoiceQuestionSchema>;

/**
 * Multi-select checkbox list — Enter/Space toggles, Tab to submit or advance.
 * Use `minSelections`/`maxSelections` to constrain the number of picks.
 */
export type MultiChoiceQuestion = Static<typeof MultiChoiceQuestionSchema>;

/**
 * Yes/No toggle — ↑/↓ or Y/N to switch, Enter to confirm.
 * Labels and colors are customizable via the `true`/`false` fields.
 */
export type BooleanQuestion = Static<typeof BooleanQuestionSchema>;

/** Discriminated union of all question types (discriminant: `type`). */
export type Question = Static<typeof QuestionSchema>;

// ── Value types ───────────────────────────────────────────────────────────────

/** Union of all question type discriminants. */
export type InputType =
  | "text"
  | "number"
  | "choice"
  | "multichoice"
  | "boolean";

/**
 * Maps each {@link InputType} to the native TypeScript type it produces.
 * Used to infer the `value` field of {@link Answer}.
 *
 * @example
 * type V = InputTypeValueMap["multichoice"]; // string[]
 * type V = InputTypeValueMap["boolean"];     // boolean
 */
export type InputTypeValueMap = {
  /** Free-form text answer. */
  text: string;
  /** Label of the selected option. */
  choice: string;
  /** Labels of all selected options. */
  multichoice: string[];
  /** Numeric value. */
  number: number;
  /** `true` = YES, `false` = NO. */
  boolean: boolean;
};

/** Union of all possible input values — useful for runtime code that handles any question type. */
export type InputValue = InputTypeValueMap[InputType];

// ── Answer ────────────────────────────────────────────────────────────────────

/**
 * Collected answer for a single question.
 *
 * Specialise via the generic parameter to get a narrowed `value` type.
 * Without a type parameter, `value` is the full union of all possible types.
 *
 * @typeParam T - The question's {@link InputType} (defaults to the full union).
 *
 * @example
 * const a: Answer<"text">      // { questionId: number; value: string | null }
 * const a: Answer<"multichoice"> // { questionId: number; value: string[] | null }
 */
export interface Answer<T extends InputType = InputType> {
  /** Zero-based index of the question in the original array. */
  questionId: number;
  /**
   * The typed answer value, or `null` when the question was skipped or left unanswered.
   * Type is narrowed to `InputTypeValueMap[T]` when `T` is specified.
   */
  value: InputTypeValueMap[T] | null;
}

// ── Form result ───────────────────────────────────────────────────────────────

/**
 * Final result passed to `done()` when the form closes.
 * Available whether the user submitted or cancelled.
 */
export interface FormResult {
  /** Original normalized questions, in order. */
  questions: Question[];
  /**
   * One entry per question, in question order.
   * `value` is `null` for skipped or unanswered questions.
   */
  answers: Answer[];
  /** `true` when the user pressed Esc and confirmed the exit dialog. */
  cancelled: boolean;
}
