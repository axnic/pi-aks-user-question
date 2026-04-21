/**
 * form/question.ts — FormQuestion wrapper linking a Question to its Input.
 *
 * A FormQuestion pairs:
 *   - The original normalized Question (kept for FormResult.questions)
 *   - Its index in the original array (used as Answer.questionId)
 *   - Display metadata extracted for convenience (question text, header, etc.)
 *   - The interactive Input widget that collects the answer
 *
 * Form holds FormQuestion[] and uses it for:
 *   - Rendering the question frame (text, description, widget, error, footer)
 *   - Passing refs to Tabs (reads fq.required and fq.input.isAnswered())
 *   - Collecting typed answers at submit time
 */

import type { Question } from "../types";
import type { Input } from "./inputs/types";

export interface FormQuestion {
  /** Zero-based position in the original questions array — stored as {@link Answer.questionId}. */
  readonly questionIdx?: number;
  /** The normalized question as provided by the LLM — included verbatim in {@link FormResult.questions}. */
  readonly originalQuestion?: Question;
  /** Short question text shown as the tab label and main heading. */
  readonly question: string;
  /** Formatted header line (includes question number and text). */
  readonly header: string;
  /** Optional longer description rendered below the header. */
  readonly description?: string;
  /** Whether the user must answer before submitting the form. */
  readonly required: boolean;
  /** Interactive widget that collects the user's answer. */
  readonly input: Input;
}
