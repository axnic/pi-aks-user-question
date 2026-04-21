/**
 * index.ts — Entrypoint for the ask-user-question extension.
 *
 * Registers the ask_user_question tool with the pi agent. The tool presents
 * structured questions to the user via an interactive TUI form and returns
 * the collected answers to the LLM.
 *
 * This file is intentionally thin: it validates parameters, delegates all TUI
 * logic to createForm(), and formats the result for the LLM.
 *
 * Module architecture (see each file for details):
 *   src/types.ts      — TypeScript types (Question, Answer, FormResult, …)
 *   src/schema.ts     — TypeBox schemas for tool parameter validation
 *   src/validation.ts — Text input validation (url, email, ip, number, regex, …)
 *   src/helpers.ts    — Pure utilities (errorResult, isBorderLine, …)
 *   src/form/         — TUI form: state, handlers, renderers
 *
 * Question types:
 *   - text:        Single-line free-form text with optional format validation.
 *   - number:      Numeric input with optional range slider (↑/↓ increments).
 *   - choice:      Single-select list; Space selects, Enter advances.
 *   - multichoice: Multi-select checkboxes; Tab to navigate/submit.
 *   - boolean:     Yes/No toggle; ↑/↓ or Y/N to switch, Enter to confirm.
 *
 * Tab bar symbols:
 *   ✔  answered (green)     · pending optional (dim)
 *   ✦  pending required (orange)   ≡  review tab (color reflects completion state)
 *
 * Keyboard shortcuts:
 *   Tab/Shift+Tab Switch between questions
 *   ↑/↓           Navigate options (choice/multichoice); toggle (boolean); increment/decrement (number)
 *   ←/→           Cursor movement (text, number)
 *   Enter         Validate and advance (text, number, boolean); advance (choice, multichoice)
 *   Space         Select/toggle option (choice/multichoice)
 *   Esc           Cancel form (with confirmation)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, TruncatedText } from "@mariozechner/pi-tui";
import {
  createFormFromParams,
  type FormController,
  validateFormParams,
} from "./src/form/index";
import { errorResult } from "./src/helpers";
import { AskUserQuestionParams } from "./src/schema";
import type { FormResult, InputValue, Question } from "./src/types";

/**
 * Registers the `ask_user_question` tool on the provided pi agent API.
 *
 * @param pi - Extension API used to register tools, render calls, and render results.
 */
export default function askUserQuestion(pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_user_question",
    label: "Ask User",
    description: `Ask the user one or more questions using a rich interactive TUI form.

Supports:
- **text**: single-line free-form text with optional format validation (url, email, ip, number, regex)
- **number**: numeric input — ↑/↓ to increment/decrement; visual slider when min and max are both set
- **choice**: single-select numbered option list — Space selects; Enter advances
- **multichoice**: multi-select checkboxes — Enter/Space toggles, Tab to submit or advance
- **boolean**: yes/no toggle — ↑/↓ or Y/N to switch, Enter to confirm

Use this when you need structured user input — preferences, configuration, confirmations, or clarifications.
Group related questions in a single call instead of chaining multiple sequential calls.`,

    promptSnippet:
      "Ask structured questions with choice, text, number, or boolean inputs",

    promptGuidelines: [
      "Prefer ask_user_question over plain-text questions whenever you need structured user input.",
      "Use 'multichoice' for 'pick all that apply' scenarios.",
      "Use 'boolean' for simple yes/no confirmations instead of a 'choice' with two options.",
      "Use 'number' with min/max to show a visual slider and constrain the input range.",
      "Set allowOther: false only when the option list is exhaustive.",
      "Set required: true for questions that must be answered before proceeding.",
      "Group related questions in a single call — avoid chaining multiple ask_user_question calls.",
      "Keep header labels short (≤12 chars): prefer 'Language' over 'Programming Language'.",
    ],

    parameters: AskUserQuestionParams,

    /**
     * Validates tool parameters, renders the TUI form, and formats the collected answers.
     *
     * @param _toolCallId - Unused tool call identifier.
     * @param params      - Raw tool parameters (questions array).
     * @param _signal     - Unused abort signal.
     * @param _onUpdate   - Unused streaming update callback.
     * @param ctx         - Execution context (provides `hasUI` and `ui.custom`).
     * @returns An MCP tool result with a text content summary and `FormResult` details.
     */
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return errorResult(
          "ask_user_question requires an interactive terminal (UI not available)",
        );
      }

      const validationError = validateFormParams(params);
      if (validationError) return errorResult(validationError);

      const result = await ctx.ui.custom<FormResult>(
        (tui, theme, _kb, done) =>
          createFormFromParams(params, tui, theme, done) as FormController,
      );

      // ── Format the result for the LLM ──────────────────────────────────────────

      if (result.cancelled) {
        return {
          content: [{ type: "text", text: "User cancelled the form." }],
          details: result,
        };
      }

      const structured: Record<string, InputValue | null> = {};
      for (const a of result.answers) {
        const q = result.questions[a.questionId];
        const key = q?.id ?? q?.header ?? `Q${a.questionId}`;
        structured[key] = a.value ?? null;
      }

      return {
        content: [{ type: "text", text: JSON.stringify(structured) }],
        details: result,
      };
    },

    // ── Chat history: tool call display ────────────────────────────────────────

    /**
     * Renders the tool call chip in chat history.
     *
     * @param args   - Raw tool arguments (questions array).
     * @param theme  - Active color theme.
     * @param _ctx   - Unused render context.
     * @returns A `TruncatedText` node showing the tool name, question count, and types.
     *   Width is determined at render time so no arbitrary truncation is applied here.
     */
    renderCall(args, theme, _ctx) {
      const qs = (args.questions as Question[]) ?? [];
      const count = qs.length;
      let text = theme.fg("toolTitle", theme.bold("ask_user_question "));
      text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
      if (count > 0) {
        const allTypes = qs
          .map((q) => q.type)
          .filter((type) => type)
          .join(", ");
        text += theme.fg("dim", ` (${allTypes})`);
      }
      return new TruncatedText(text, 0, 0);
    },

    // ── Chat history: tool result display ──────────────────────────────────────

    /**
     * Renders the tool result in chat history.
     *
     * Shows per-answer lines (`✔ Header: value` or `· Header: (not answered)`)
     * for a completed form, a warning for a cancelled form, and a plain error
     * message when the tool failed (e.g. no UI).
     *
     * @param result - MCP tool result carrying content text and `FormResult` details.
     * @param _opts  - Unused render options.
     * @param theme  - Active color theme.
     * @param _ctx   - Unused render context.
     * @returns A `Text` node summarising the form outcome.
     */
    renderResult(result, _opts, theme, _ctx) {
      const details = result.details as FormResult | undefined;
      const t = result.content[0];
      const contentText = t?.type === "text" ? t.text : "";
      if (!details) {
        return new Text(contentText, 0, 0);
      }
      if (details.cancelled) {
        // When answers are empty it's a tool error — show the actual message.
        // When answers exist (user cancelled mid-form) fall back to "Cancelled".
        if ((details.answers?.length ?? 0) === 0 && contentText) {
          return new Text(contentText, 0, 0);
        }
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      const lines = details.answers.map((a) => {
        const q = details.questions[a.questionId];
        const sym =
          a.value !== null ? theme.fg("success", "✔") : theme.fg("dim", "·");
        const header = theme.fg("accent", q?.question ?? `Q${a.questionId}`);
        const value =
          a.value !== null
            ? formatAnswerValue(a.value)
            : theme.fg("dim", "(not answered)");
        return `${sym} ${header}: ${value}`;
      });

      return new Text(lines.join("\n"), 0, 0);
    },
  });
}

/** Formats a typed answer value as a human-readable string. */
function formatAnswerValue(value: InputValue): string {
  if (Array.isArray(value))
    return value.length > 0 ? value.join(", ") : "(none selected)";
  return String(value);
}
