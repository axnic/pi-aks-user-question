/**
 * schema.ts — TypeBox schema for the ask_user_question tool parameters.
 *
 * Two purposes:
 *   1. Runtime validation of the JSON provided by the LLM.
 *   2. JSON Schema generation for tool registration (the LLM reads this).
 *
 * Design:
 *   - ValidationSchema is imported from validation.ts so format-level schemas
 *     stay in sync with their TypeScript types and implementations.
 *   - Shared building blocks (base fields, option shape) are defined once
 *     and spread into each question variant.
 *   - Each question variant is a named export so types.ts can derive
 *     TypeScript types from them via Static<typeof XxxQuestionSchema>.
 *   - QuestionSchema is a single discriminated union — one place to read
 *     to understand every possible question shape.
 *
 * Exports:
 *   ChoiceOptionSchema          — option shape for choice/multichoice lists
 *   BooleanCustomizableOptionSchema — label/color shape for boolean sides
 *   TextQuestionSchema          — type: "text"
 *   NumberQuestionSchema        — type: "number"
 *   ChoiceQuestionSchema        — type: "choice"
 *   MultiChoiceQuestionSchema   — type: "multichoice"
 *   BooleanQuestionSchema       — type: "boolean"
 *   QuestionSchema              — discriminated union on `type`
 *   AskUserQuestionParams       — root params object { questions: QuestionSchema[] }
 */

import { Type } from "@sinclair/typebox";
import { NumericValidationSchema, StringValidationSchema } from "./validation";

// ── Shared building blocks ────────────────────────────────────────────────────

const baseFields = {
  id: Type.String({
    description:
      "Stable identifier for this question — used to match answers back to questions",
    examples: ["language", "port", "enable-tls"],
  }),
  question: Type.String({
    description:
      "Full question text — must end with '?' and contain nothing after it. Keep it short (one sentence, ≤10 words); never add notes, examples, or parenthetical remarks after the '?'.",
    pattern: "^[^?]*\\??$",
    examples: ["Which programming language do you prefer?"],
  }),
  header: Type.String({
    description: "Short tab label (≤12 chars recommended)",
    examples: ["Language", "Port", "Enable TLS"],
  }),
  required: Type.Optional(
    Type.Boolean({
      description:
        "Mark as mandatory — tab shows ✦ and review warns if unanswered (default: false)",
    }),
  ),
  description: Type.Optional(
    Type.String({
      description:
        "Optional context shown below the question text (max 4 lines)",
      examples: ["This will be used as the default namespace."],
    }),
  ),
};

/** A selectable option in a choice or multichoice question. */
export const ChoiceOptionSchema = Type.Object({
  label: Type.String({
    description: "Display text for this option (1–5 words)",
    examples: ["TypeScript", "Python", "Other"],
  }),
  description: Type.Optional(
    Type.String({
      description: "Brief explanation shown below the label",
      examples: ["Strongly typed superset of JavaScript"],
    }),
  ),
});

const optionsField = Type.Array(ChoiceOptionSchema, {
  minItems: 2,
  description: "Selectable options — minimum 2 required",
});

const allowOtherField = Type.Optional(
  Type.Boolean({
    description:
      'Append a free-text "Other…" entry at the bottom (default: true)',
  }),
);

/** Customizable label and color for one side of a boolean toggle. */
export const BooleanCustomizableOptionSchema = Type.Object({
  label: Type.String({
    description: "Display label",
    examples: ["Yes", "Confirm"],
  }),
  color: Type.Optional(
    Type.String({
      description:
        "Theme color (default: 'success' for true, 'error' for false)",
      examples: ["success", "error", "warning", "accent"],
    }),
  ),
});

// ── Question schemas — one per type ───────────────────────────────────────────

/** Single-line free-form text with optional format validation. */
export const TextQuestionSchema = Type.Object(
  {
    ...baseFields,
    type: Type.Literal("text"),
    placeholder: Type.String({
      description:
        "Single-line hint text shown in the empty input field (no newlines — the input is a single-line field)",
      pattern: "^[^\\n\\r]*$",
      examples: ["e.g. https://example.com", "e.g. 8080"],
    }),
    validation: Type.Optional(StringValidationSchema),
  },
  {
    description: "Single-line free-form text with optional format validation",
    examples: [
      {
        type: "text",
        question: "What is the API endpoint?",
        header: "Endpoint",
        placeholder: "e.g. https://api.example.com",
        validation: { format: "url", protocols: ["https"] },
      },
    ],
  },
);

/** Numeric input with optional ←/→ slider and bounds. */
export const NumberQuestionSchema = Type.Object(
  {
    ...baseFields,
    type: Type.Literal("number"),
    placeholder: Type.Optional(
      Type.Number({
        description: "Hint text when field is empty",
        examples: [8080, -2e4, Math.PI],
      }),
    ),
    step: Type.Optional(
      Type.Number({
        description: "Arrow key increment/decrement step (default: 1)",
      }),
    ),
    validation: Type.Optional(NumericValidationSchema),
  },
  {
    description:
      "Numeric input — ←/→ arrows increment/decrement by step; a range slider appears when both min and max are set",
    examples: [
      {
        type: "number",
        question: "Which port?",
        header: "Port",
        defaultValue: 8080,
        validation: { format: "integer", min: 1, max: 65535 },
      },
    ],
  },
);

/** Single-select numbered list — auto-advances after selection. */
export const ChoiceQuestionSchema = Type.Object(
  {
    ...baseFields,
    type: Type.Literal("choice"),
    options: optionsField,
    allowOther: allowOtherField,
  },
  {
    description:
      "Single-select numbered list — Space picks; Enter advances. In single-question forms, Enter submits immediately.",
    examples: [
      {
        type: "choice",
        question: "Which runtime do you target?",
        header: "Runtime",
        options: [{ label: "Node.js" }, { label: "Deno" }, { label: "Bun" }],
        allowOther: false,
      },
    ],
  },
);

/** Multi-select checkbox list. */
export const MultiChoiceQuestionSchema = Type.Object(
  {
    ...baseFields,
    type: Type.Literal("multichoice"),
    options: optionsField,
    allowOther: allowOtherField,
    minSelections: Type.Optional(
      Type.Number({
        description:
          "Minimum selections required before Tab/submit (default: none)",
        minimum: 1,
      }),
    ),
    maxSelections: Type.Optional(
      Type.Number({
        description: "Maximum selections allowed (default: unlimited)",
      }),
    ),
  },
  {
    description:
      "Multi-select checkboxes — Space toggles; Enter advances to next question",
    examples: [
      {
        type: "multichoice",
        question: "Which features should be enabled?",
        header: "Features",
        options: [
          { label: "Auth" },
          { label: "Caching" },
          { label: "Logging" },
        ],
        minSelections: 1,
      },
    ],
  },
);

/** Yes/No toggle with customizable labels and colors. */
export const BooleanQuestionSchema = Type.Object(
  {
    ...baseFields,
    type: Type.Literal("boolean"),
    defaultValue: Type.Optional(
      Type.Boolean({
        description: "Initial selection shown on focus (default: true = YES)",
      }),
    ),
    true: Type.Optional(BooleanCustomizableOptionSchema),
    false: Type.Optional(BooleanCustomizableOptionSchema),
  },
  {
    description: "Yes/No toggle — ↑/↓ or Y/N to switch, Enter to confirm",
    examples: [
      {
        type: "boolean",
        question: "Enable TLS?",
        header: "TLS",
        defaultValue: true,
      },
      {
        type: "boolean",
        question: "Overwrite existing files?",
        header: "Overwrite",
        defaultValue: false,
        true: { label: "Overwrite", color: "error" },
        false: { label: "Keep", color: "success" },
      },
    ],
  },
);

// ── QuestionSchema — discriminated union on `type` ────────────────────────────

/**
 * Discriminated union of all supported question types, keyed on `type`.
 *
 * | type          | Input style                                 | value type |
 * |---------------|---------------------------------------------|------------|
 * | `text`        | Single-line text + optional validation      | string     |
 * | `number`      | Numeric field + ←/→ step + optional slider  | number     |
 * | `choice`      | Numbered list, picks one, auto-advances     | string     |
 * | `multichoice` | Checkboxes, toggles freely                  | string[]   |
 * | `boolean`     | Yes/No toggle, ↑/↓ or Y/N                  | boolean    |
 */
export const QuestionSchema = Type.Union([
  TextQuestionSchema,
  NumberQuestionSchema,
  ChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
  BooleanQuestionSchema,
]);

// ── Tool params ───────────────────────────────────────────────────────────────

export const AskUserQuestionParams = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: 1,
    description:
      "Questions to display. A tab bar with scroll appears automatically for multiple questions.",
  }),
});
