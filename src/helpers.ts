/**
 * helpers.ts — Pure utilities for ask-user-question.
 *
 * Small stateless functions shared between the form logic and the
 * extension entrypoint. No dependencies on form/ — can be imported by any module.
 *
 * Exports:
 *   MAX_VISIBLE_OPTIONS  — max number of visible options before scrolling activates
 *   errorResult()        — builds a cancelled error result for the tool
 *   stripAnsi()          — removes ANSI escape codes from a string
 *   isBorderLine()       — detects Editor border lines (lines made entirely of '─')
 *
 * Note on `stripAnsi`: pi-tui does not export a strip function — `wrapTextWithAnsi`
 * is not equivalent (it wraps while preserving ANSI codes; it does not remove them).
 * `stripAnsi` is therefore kept as a local utility. It is used by `isBorderLine` to
 * inspect raw character content after stripping styling from Editor output lines.
 */

import type { FormResult } from "./types";

/** Maximum number of options visible in the list before scrolling activates. */
export const MAX_VISIBLE_OPTIONS = 4;

/**
 * Builds an error result for the tool (UI unavailable, invalid parameters, etc.).
 * The form is treated as cancelled and no answers are provided.
 */
export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    details: { questions: [], answers: [], cancelled: true } as FormResult,
  };
}

/**
 * Removes ANSI escape codes from a string.
 *
 * @example
 * stripAnsi("\u001b[32mHello\u001b[0m") // → "Hello"
 */
export function stripAnsi(s: string): string {
  // Matches all ANSI CSI sequences: ESC [ parameters intermediates final-byte
  // biome-ignore lint/suspicious/noControlCharactersInRegex: \u001b (ESC) is intentional — this regex exists to strip ANSI codes
  return s.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

/**
 * Returns true if the line consists entirely of '─' characters (after ANSI stripping).
 * Used to detect and skip the top/bottom border lines added by the Editor component.
 *
 * @example
 * isBorderLine("──────────") // → true
 * isBorderLine(" > hello")   // → false
 */
const BORDER_RE = /^─+$/;

export function isBorderLine(s: string): boolean {
  return BORDER_RE.test(stripAnsi(s).trim());
}
