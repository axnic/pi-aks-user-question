/**
 * form/index.ts — Factory for the ask-user-question TUI form.
 *
 * Exports:
 *   createForm()          — takes already-normalized Question[], builds the TUI controller.
 *   createFormFromParams() — full factory: validates raw JSON, normalizes, builds.
 *
 * Internal flow of createForm():
 *   1. Converts normalized Questions into FormQuestion wrappers with typed Input instances.
 *   2. Creates the shared Editor (used by string/textarea/choice inputs).
 *   3. Instantiates a Form, which wires navigation, rendering, and lifecycle.
 *   4. Returns the { render, handleInput, invalidate } controller expected by ctx.ui.custom().
 *
 * Architecture:
 *   form/inputs/  — one Input class per question type (state + render + handleInput)
 *   form/form.ts  — Form class: tab navigation, review screen, collect-and-finish
 *   form/tabs.ts  — Tabs class: tab bar rendering and navigation
 *   form/question.ts — FormQuestion: metadata + Input + original Question reference
 */

import { Editor, type EditorTheme, type TUI } from "@mariozechner/pi-tui";
import type { FormResult, Question } from "../types";
import { Form } from "./form";
import { BooleanInput } from "./inputs/boolean";
import { ChoiceInput } from "./inputs/choice";
import { NumberInput } from "./inputs/number";
import { TextInput } from "./inputs/text";
import type { Input, InputCallbacks, Theme } from "./inputs/types";
import type { FormQuestion } from "./question";

// ── Input factory ─────────────────────────────────────────────────────────────

/**
 * Converts a normalized Question into its corresponding Input instance.
 *
 * @param q         - Normalized question (defaults already resolved).
 * @param editor    - Shared Editor instance.
 * @param callbacks - Lifecycle callbacks wired to the parent Form.
 */
function createInput(
  q: Question,
  editor: Editor,
  callbacks: InputCallbacks,
): Input {
  switch (q.type) {
    case "text":
      return new TextInput(q, editor, callbacks);
    case "number":
      return new NumberInput(q, editor, callbacks);
    case "choice":
      return new ChoiceInput(q, editor, callbacks);
    case "multichoice":
      return new ChoiceInput(q, editor, callbacks, true);
    case "boolean":
      return new BooleanInput(q, editor, callbacks);
  }
}

// ── TUI controller ────────────────────────────────────────────────────────────

/** Controller returned by {@link createForm}, consumed by `ctx.ui.custom()`. */
export type FormController = {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
};

/**
 * Builds the TUI form controller from an array of normalized questions.
 *
 * This is the low-level entry point. Prefer {@link createFormFromParams} when
 * starting from raw JSON (it handles validation and normalization too).
 *
 * @param questions - Normalized questions to display (defaults already resolved).
 * @param tui       - TUI instance used to trigger re-renders.
 * @param theme     - Active color theme.
 * @param done      - Callback invoked with the final {@link FormResult} on submit or cancel.
 */
export function createForm(
  questions: Question[],
  tui: TUI,
  theme: Theme,
  done: (result: FormResult) => void,
): FormController {
  const editorTheme: EditorTheme = {
    borderColor: (s) => theme.fg("accent", s),
    selectList: {
      selectedPrefix: (t) => theme.fg("accent", t),
      selectedText: (t) => theme.fg("accent", t),
      description: (t) => theme.fg("muted", t),
      scrollInfo: (t) => theme.fg("dim", t),
      noMatch: (t) => theme.fg("warning", t),
    },
  };
  const editor = new Editor(tui, editorTheme);

  // Deferred callbacks break the circular dependency: inputs need callbacks at construction
  // time, but callbacks point to Form methods — and Form needs inputs to exist first.
  // Solution: create stub callbacks, pass them to inputs, then overwrite with real ones
  // after Form is instantiated (see "Wire deferred callbacks" block below).
  const deferredCallbacks: InputCallbacks = {
    onAdvance: () => {},
    onRetreat: () => {},
    onSubmit: () => {},
    onRefresh: () => {},
  };

  const formQuestions: FormQuestion[] = questions.map((q, idx) => ({
    questionIdx: idx,
    originalQuestion: q,
    question: q.question,
    header: q.header,
    description: q.description,
    required: q.required ?? false,
    input: createInput(q, editor, deferredCallbacks),
  }));

  const form = new Form(
    formQuestions,
    editor,
    theme,
    () => tui.requestRender(),
    done,
  );

  // Wire deferred callbacks now that Form exists.
  const cb = form.createCallbacks();
  deferredCallbacks.onAdvance = cb.onAdvance;
  deferredCallbacks.onRetreat = cb.onRetreat;
  deferredCallbacks.onSubmit = cb.onSubmit;
  deferredCallbacks.onRefresh = cb.onRefresh;

  return {
    render: (width) => form.render(width),
    invalidate: () => form.invalidate(),
    handleInput: (data) => form.handleInput(data),
  };
}

// ── Full factory ──────────────────────────────────────────────────────────────

/** Returned when raw params fail validation. */
export type FormCreationError = { error: string };

const ALLOWED_QUESTION_TYPES = new Set([
  "boolean",
  "choice",
  "multichoice",
  "number",
  "text",
]);

/**
 * Validates raw tool params without building the form.
 *
 * @param rawParams - Unvalidated tool call params (as provided by the LLM).
 * @returns `null` if valid, or an error string on failure.
 */
export function validateFormParams(rawParams: unknown): string | null {
  if (
    !rawParams ||
    typeof rawParams !== "object" ||
    !Array.isArray((rawParams as { questions?: unknown }).questions) ||
    (rawParams as { questions: unknown[] }).questions.length === 0
  ) {
    return "ask_user_question: params must have a non-empty 'questions' array";
  }

  const raw = rawParams as { questions: unknown[] };

  for (const q of raw.questions) {
    if (!q || typeof q !== "object") {
      return "ask_user_question: each question must be an object";
    }
    const qObj = q as Record<string, unknown>;

    if (
      typeof qObj.type !== "string" ||
      typeof qObj.question !== "string" ||
      typeof qObj.header !== "string"
    ) {
      return "ask_user_question: each question needs string 'type', 'question', and 'header' fields";
    }

    if (!ALLOWED_QUESTION_TYPES.has(qObj.type)) {
      return `ask_user_question: unsupported question type '${qObj.type}'`;
    }

    if (
      (qObj.type === "choice" || qObj.type === "multichoice") &&
      (!Array.isArray(qObj.options) || (qObj.options as unknown[]).length < 2)
    ) {
      return `ask_user_question: question "${qObj.header}" needs at least 2 options`;
    }

    if (qObj.type === "text" && typeof qObj.placeholder !== "string") {
      return `ask_user_question: question "${qObj.header}" (type '${qObj.type}') is missing a 'placeholder'`;
    }

    if (qObj.type === "multichoice") {
      const min = qObj.minSelections as number | undefined;
      const max = qObj.maxSelections as number | undefined;
      if (min !== undefined && max !== undefined && min > max) {
        return `ask_user_question: question "${qObj.header}" minSelections (${min}) > maxSelections (${max})`;
      }
    }
  }

  return null;
}

/**
 * Full factory: validates raw tool params, normalizes questions, and builds the form.
 *
 * Business rules checked:
 *   - `params.questions` must be a non-empty array.
 *   - Each question must have string `type`, `question`, and `header` fields.
 *   - `type` must be one of the supported question types.
 *   - `choice`/`multichoice` questions need at least 2 options.
 *   - `text` questions need a `placeholder`.
 *   - `multichoice` `minSelections` must not exceed `maxSelections` when both are set.
 *
 * @param rawParams - Unvalidated tool call params (as provided by the LLM).
 * @param tui       - TUI instance.
 * @param theme     - Active color theme.
 * @param done      - Callback invoked with the final {@link FormResult}.
 * @returns A {@link FormController} on success, or a {@link FormCreationError} on failure.
 */
export function createFormFromParams(
  rawParams: unknown,
  tui: TUI,
  theme: Theme,
  done: (result: FormResult) => void,
): FormController | FormCreationError {
  const error = validateFormParams(rawParams);
  if (error) return { error };

  const raw = rawParams as { questions: unknown[] };
  return createForm(raw.questions as Question[], tui, theme, done);
}
